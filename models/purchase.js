const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    cart: {
        type: Array,
    },
    address:Object,
    date: {
        type: Date,
        default: Date.now()
    }
});

module.exports = Purchase = mongoose.model("Purchase", purchaseSchema);