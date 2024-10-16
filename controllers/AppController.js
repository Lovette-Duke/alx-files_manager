import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AppController {
    static getStatus(req, res) {
        if (redisClient.isAlive() && dbClient.isAlive()) {
            return res.status(200).json({ redis: true, db: true });
        }
        return res.status(400).send('Redis and MongoDB not connected');
    }

    static getStats(req, res) {
        (async () => {
            const users = await dbClient.nbUsers();
            const files = await dbClient.nbFiles();
            return res.status(200).json({ users, files });
        })();
    }
}

module.exports = AppController;