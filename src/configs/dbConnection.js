const mongoose = require('mongoose')

const connectDatabase = async (dbName, connectionString) => {
    try {
        await mongoose.connect(connectionString, {
            dbName,
            useNewUrlParser: true,
            useUnifiedTopology: true
        })
        console.log("Database connected successfully!")
    } catch (e) {
        console.log("Error while connecting to Database", e)
    }
}

module.exports = {
    connectDatabase
}