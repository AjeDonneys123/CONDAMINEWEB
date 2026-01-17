




const mongoose = require('mongoose');

const StructureDB = {
    getAll: async () => await mongoose.model('Chapter').find({}).lean(),
    save: async (data) => await mongoose.model('Chapter').create(data),
    update: async (id, data) => await mongoose.model('Chapter').findByIdAndUpdate(id, { $set: data }, { new: true }),
    delete: async (id) => await mongoose.model('Chapter').findByIdAndDelete(id)
};

module.exports = StructureDB;




