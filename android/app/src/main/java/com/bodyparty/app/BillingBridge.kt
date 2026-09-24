package com.bodyparty.app

import android.app.Activity
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingClient.ProductType
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import org.json.JSONObject

/**
 * Google Play Billing for the game.
 *
 * Products (create them with exactly these IDs in the Google Play Console):
 *  - party_pack   : one-time in-app product (non-consumable)  -> Party Pack
 *  - plus_monthly : subscription with a monthly base plan      -> Body Party Plus
 *
 * The page reads state with AndroidBilling.getState() and receives updates in
 * window.onBillingState({...}).
 */
class BillingBridge(private val activity: Activity, private val web: WebView) : PurchasesUpdatedListener {

    private val client: BillingClient = BillingClient.newBuilder(activity)
        .setListener(this)
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .build()

    @Volatile private var ready = false
    @Volatile private var ownsPack = false
    @Volatile private var ownsPlus = false
    @Volatile private var error = ""
    private var packDetails: ProductDetails? = null
    private var plusDetails: ProductDetails? = null

    fun connect() {
        if (client.isReady) return
        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingResponseCode.OK) {
                    ready = true
                    error = ""
                    loadProducts()
                    queryPurchases()
                } else {
                    error = result.debugMessage.ifEmpty { "Google Play is not available (${result.responseCode})" }
                }
                push()
            }

            override fun onBillingServiceDisconnected() {
                ready = false
                push()
            }
        })
    }

    fun end() {
        if (client.isReady) client.endConnection()
    }

    private fun loadProducts() {
        fun query(id: String, type: String, done: (ProductDetails?) -> Unit) {
            val params = QueryProductDetailsParams.newBuilder()
                .setProductList(listOf(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(type).build()))
                .build()
            client.queryProductDetailsAsync(params) { _, list -> done(list.firstOrNull()); push() }
        }
        query(PACK, ProductType.INAPP) { packDetails = it }
        query(PLUS, ProductType.SUBS) { plusDetails = it }
    }

    private fun queryPurchases() {
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(ProductType.INAPP).build()) { r, list ->
            if (r.responseCode == BillingResponseCode.OK) { ownsPack = list.any { owns(it, PACK) }; list.forEach(::acknowledge); push() }
        }
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(ProductType.SUBS).build()) { r, list ->
            if (r.responseCode == BillingResponseCode.OK) { ownsPlus = list.any { owns(it, PLUS) }; list.forEach(::acknowledge); push() }
        }
    }

    private fun owns(p: Purchase, id: String) = p.purchaseState == Purchase.PurchaseState.PURCHASED && id in p.products

    private fun acknowledge(p: Purchase) {
        if (p.purchaseState != Purchase.PurchaseState.PURCHASED || p.isAcknowledged) return
        client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.purchaseToken).build()) { }
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        when (result.responseCode) {
            BillingResponseCode.OK -> {
                purchases.orEmpty().forEach { p ->
                    acknowledge(p)
                    if (owns(p, PACK)) ownsPack = true
                    if (owns(p, PLUS)) ownsPlus = true
                    if (p.purchaseState == Purchase.PurchaseState.PENDING) push("⏳ Payment pending – it unlocks when Google Play confirms it.")
                }
                push()
            }
            BillingResponseCode.ITEM_ALREADY_OWNED -> { queryPurchases(); push("You already own this – restoring it.") }
            BillingResponseCode.USER_CANCELED -> push("Purchase cancelled.")
            else -> push("Purchase failed: ${result.debugMessage.ifEmpty { "error ${result.responseCode}" }}")
        }
    }

    private fun state(message: String? = null): String = JSONObject().apply {
        put("ready", ready)
        put("pack", ownsPack)
        put("plus", ownsPlus)
        put("packPrice", packDetails?.oneTimePurchaseOfferDetails?.formattedPrice ?: "")
        put("plusPrice", plusDetails?.subscriptionOfferDetails?.firstOrNull()?.pricingPhases?.pricingPhaseList?.lastOrNull()?.formattedPrice ?: "")
        put("error", error)
        if (message != null) put("message", message)
    }.toString()

    private fun push(message: String? = null) {
        val json = state(message)
        web.post { web.evaluateJavascript("window.onBillingState && window.onBillingState($json)", null) }
    }

    // ---- called from JavaScript (on a background thread)

    @JavascriptInterface
    fun getState(): String = state()

    @JavascriptInterface
    fun refresh() {
        activity.runOnUiThread { if (client.isReady) queryPurchases() else connect() }
    }

    @JavascriptInterface
    fun buy(productId: String) {
        activity.runOnUiThread {
            if (!client.isReady) { connect(); push("Connecting to Google Play… try again in a moment."); return@runOnUiThread }
            val details = if (productId == PLUS) plusDetails else if (productId == PACK) packDetails else null
            if (details == null) { push("This product is not available yet in Google Play."); return@runOnUiThread }
            val params = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details)
            if (productId == PLUS) {
                val offer = details.subscriptionOfferDetails?.firstOrNull()
                if (offer == null) { push("The subscription has no active plan in Google Play."); return@runOnUiThread }
                params.setOfferToken(offer.offerToken)
            }
            val flow = BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(params.build())).build()
            client.launchBillingFlow(activity, flow)
        }
    }

    companion object {
        const val PACK = "party_pack"
        const val PLUS = "plus_monthly"
    }
}
