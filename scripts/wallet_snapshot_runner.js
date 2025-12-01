const walletSnap = require("../utilities/wallet-snap");

(async () => {
    console.log("🔄 Running wallet snapshot...");
    try {
        await walletSnap();
        console.log("✅ Snapshot completed");
    } catch (err) {
        console.error("❌ Error running snapshot:", err);
    }
})();