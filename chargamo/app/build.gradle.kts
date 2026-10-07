plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The API key is never baked into builds from this public repo. Share the key
// to the app instead (see README), or pass -PGEMINI_API_KEY=... for a private build.
val geminiKey = (findProperty("GEMINI_API_KEY") as String?) ?: ""
val geminiModel = (findProperty("GEMINI_MODEL") as String?) ?: "gemini-3.8-live"

// Fixed sideload key so new builds install as updates over old ones. Kept as base64 text in the repo.
val sideloadKeystore = layout.buildDirectory.file("chargamo-sideload.jks").get().asFile.also {
    it.parentFile.mkdirs()
    it.writeBytes(java.util.Base64.getMimeDecoder().decode(file("chargamo-sideload.jks.b64").readText()))
}

android {
    namespace = "se.chargamo"
    compileSdk = 35

    defaultConfig {
        applicationId = "se.chargamo"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "GEMINI_API_KEY", "\"$geminiKey\"")
        buildConfigField("String", "GEMINI_MODEL", "\"$geminiModel\"")
    }

    signingConfigs {
        create("sideload") {
            storeFile = sideloadKeystore
            storePassword = "chargamo"
            keyAlias = "chargamo"
            keyPassword = "chargamo"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("sideload")
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.camera:camera-core:1.4.1")
    implementation("androidx.camera:camera-camera2:1.4.1")
    implementation("androidx.camera:camera-lifecycle:1.4.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}
