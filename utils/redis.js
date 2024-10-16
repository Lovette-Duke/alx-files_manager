const redis = require('redis');
const { promisify } = require('util');

class RedisClient {
    constructor() {
        // Create a Redis client instance
        this.client = redis.createClient();
        this.client.on('error', (err) => {
            console.log(err);
        });
    }

    // check if the Redis client is alive
    isAlive() {
        return this.client.connected;
    }

    async get(key) {
        const getAsync = promisify(this.client.get).bind(this.client);
        return getAsync(key);
    }

    async set(key, value, duration) {
        const setAsync = promisify(this.client.set).bind(this.client);
        return setAsync(key, value, 'EX', duration);
    }

    async del(key) {
        const delAsync = promisify(this.client.del).bind(this.client);
        return delAsync(key);
    }
}

const redisClient = new RedisClient();
module.exports = redisClient;