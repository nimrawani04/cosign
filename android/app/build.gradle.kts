plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val cosignUrl = providers.gradleProperty("COSIGN_URL").orElse("https://cosign.example.com").get()

android {
    namespace = "com.cosign.mobile"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.cosign.mobile"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "COSIGN_URL", "\"$cosignUrl\"")
        manifestPlaceholders["cleartextAllowed"] = cosignUrl.startsWith("http://").toString()
    }

    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
