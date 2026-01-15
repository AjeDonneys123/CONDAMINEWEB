const mongoose = require('mongoose');
require('dotenv').config();
async function init() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("BDD Init");
    process.exit();
}
init();