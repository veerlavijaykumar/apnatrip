const mongoose = require('mongoose');

const priceSchema = new mongoose.Schema({
    Destination: { type: String, required: true },
    Estimated_cost: { type: String, required: true },
    Distance:{type:String,required:true}
});

module.exports = mongoose.model('Price', priceSchema);
