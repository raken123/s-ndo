/* gmfy — checkout for the Pro / Max plans.
 *
 * This validates the CARD FORMAT only: a Luhn-valid number, a real-looking
 * expiry that is not in the past, and a CVV of the right length. Any card that
 * is well-formed passes — including the standard test numbers. Nothing is sent
 * anywhere, nothing is stored, and NO CARD IS CHARGED. The success screen says
 * exactly that, so no one is misled into thinking money moved.
 */
(function (global) {
  'use strict';

  var PRICE = { go: '$2/mo', pro: '$20/mo', max: '$390/mo' };

  /* ---- validators ---- */
  function digits(s) { return (s || '').replace(/\D/g, ''); }

  // Luhn checksum — the same check every card entry field runs client-side
  function luhnOK(num) {
    num = digits(num);
    if (num.length < 12 || num.length > 19) return false;
    var sum = 0, alt = false;
    for (var i = num.length - 1; i >= 0; i--) {
      var d = num.charCodeAt(i) - 48;
      if (alt) { d *= 2; if (d > 9) d -= 9; }
      sum += d; alt = !alt;
    }
    return sum % 10 === 0;
  }

  function brand(num) {
    num = digits(num);
    if (/^4/.test(num)) return 'Visa';
    if (/^(5[1-5]|2[2-7])/.test(num)) return 'Mastercard';
    if (/^3[47]/.test(num)) return 'Amex';
    if (/^6(011|5)/.test(num)) return 'Discover';
    return 'Card';
  }

  function expiryOK(mm, yy) {
    mm = parseInt(mm, 10); yy = parseInt(yy, 10);
    if (!(mm >= 1 && mm <= 12)) return false;
    if (isNaN(yy)) return false;
    var full = yy < 100 ? 2000 + yy : yy;
    var now = new Date();
    var end = new Date(full, mm, 1);      // first day of the month after expiry
    return end > now && full <= now.getFullYear() + 20;
  }

  function cvvOK(cvv, num) {
    cvv = digits(cvv);
    return brand(num) === 'Amex' ? cvv.length === 4 : cvv.length === 3;
  }

  /* returns {ok:true, brand, last4} or {ok:false, field, msg} */
  function validate(f) {
    if (!f.name || f.name.trim().length < 2)
      return { ok: false, field: 'name', msg: 'Enter the name on the card.' };
    if (!luhnOK(f.number))
      return { ok: false, field: 'number',
               msg: 'That card number does not pass the format check.' };
    var m = (f.expiry || '').split('/');
    if (m.length !== 2 || !expiryOK(m[0], m[1]))
      return { ok: false, field: 'expiry', msg: 'Expiry must be MM/YY and in the future.' };
    if (!cvvOK(f.cvv, f.number))
      return { ok: false, field: 'cvv',
               msg: brand(f.number) === 'Amex' ? 'Amex CVV is 4 digits.'
                                               : 'CVV is 3 digits.' };
    var n = digits(f.number);
    return { ok: true, brand: brand(f.number), last4: n.slice(-4) };
  }

  /* ---- formatting helpers for the inputs ---- */
  function groupNumber(v, isAmex) {
    v = digits(v).slice(0, isAmex ? 15 : 16);
    var out = isAmex ? [v.slice(0, 4), v.slice(4, 10), v.slice(10)]
                     : v.match(/.{1,4}/g) || [];
    return out.filter(Boolean).join(' ');
  }

  function groupExpiry(v) {
    v = digits(v).slice(0, 4);
    return v.length <= 2 ? v : v.slice(0, 2) + '/' + v.slice(2);
  }

  global.GmfyPay = {
    price: function (id) { return PRICE[id] || ''; },
    validate: validate,
    brand: brand,
    luhnOK: luhnOK,
    groupNumber: groupNumber,
    groupExpiry: groupExpiry,
    digits: digits
  };
})(window);
