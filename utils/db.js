const { MongoClient } = require('mongodb');

class DBCLient {
    constructor() {
        // checks environment variables for db
        const localHost = process.env.DB_HOST || 'localhost';
        const port = process.env.DB_PORT || 27017;
        const database = process.env.DB_DATABASE || 'files_manager';
        const url = `mongodb://${localHost}:${port}`;
        this.client = new MongoClient(url, { useUnifiedTopology: true });
        this.client.connect((err) => {
            if (err) console.log(err);
            this.db = this.client.db(database);
        });
    }

    // check connection
    isAlive() {
        return this.client.isConnected();
    }

    // counts no. of users
    async nbUsers() {
        return this.db.collection('users').countDocuments({});
    }

    // counts no. of files
    async nbFiles() {
        return this.db.collection('files').countDocuments({});
    }
}

const dbClient = new DBCLient();
module.exports = dbClient;