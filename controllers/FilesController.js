import dbClient from '../utils/db';
import redisClient from '../utils/redis';
import { v4 as uuidv4 } from 'uuid';
const { ObjectID } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const Queue = require('bull');
const { findUserByTokenId } = require('../utils/helpers');

class FilesController {
    static async postUpload(request, response) {
        const fileQueue = new Queue('fileQueue');
        // Retrieve the user based on the token
        const userId = await findUserByTokenId(request);
        if (!userId) return response.status(401).json({ error: 'Unauthorized' });

        let fileInserted;

        // Validate the request data
        const { name } = request.body;
        if (!name) return response.status(400).json({ error: 'Missing name' });
        const { type } = request.body;
        if (!type || !['folder', 'file', 'image'].includes(type)) { return response.status(400).json({ error: 'Missing type' }); }

        const isPublic = request.body.isPublic || false;
        const parentId = request.body.parentId || 0;
        const { data } = request.body;
        if (!data && !['folder'].includes(type)) { return response.status(400).json({ error: 'Missing data' }); }
        // parentId (optional) as ID of the parent (default 0-> root)
        if (parentId !== 0) {
            const parentFileArray = await dbClient.files.find({ _id: ObjectID(parentId) }).toArray();
            if (parentFileArray.length === 0) return response.status(400).json({ error: 'Parent not found' });
            const file = parentFileArray[0];
            if (file.type !== 'folder') return response.status(400).json({ error: 'Parent is not a folder' });
        }

        // if no data, and not a folder, error
        if (!data && type !== 'folder') return response.status(400).json({ error: 'Missing Data' });

        // if type is folder then insert into DB, owner is ObjectID(userId)
        if (type === 'folder') {
            fileInserted = await dbClient.files.insertOne({
                userId: ObjectID(userId),
                name,
                type,
                isPublic,
                parentId: parentId === 0 ? parentId : ObjectID(parentId),
            });
        } else {
            const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
            if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true }, () => { });

            // Create ID and new path to new file
            const filenameUUID = uuidv4();
            const localPath = `${folderPath}/${filenameUUID}`;

            // write to new path
            const clearData = Buffer.from(data, 'base64');
            await fs.promises.writeFile(localPath, clearData.toString(), { flag: 'w+' });
            await fs.readdirSync('/').forEach((file) => {
                console.log(file);
            });

            fileInserted = await dbClient.files.insertOne({
                userId: ObjectID(userId),
                name,
                type,
                isPublic,
                parentId: parentId === 0 ? parentId : ObjectID(parentId),
                localPath,
            });

            // save image in binary
            if (type === 'image') {
                await fs.promises.writeFile(localPath, clearData, { flag: 'w+', encoding: 'binary' });
                await fileQueue.add({ userId, fileId: fileInserted.insertedId, localPath });
            }
        }

        // Returns new file with status code 201
        return response.status(201).json({
            id: fileInserted.ops[0]._id, userId, name, type, isPublic, parentId,
        });
    }

    static async getShow(request, response) {
        // Retrieve the user based on the token
        const token = request.headers['x-token'];
        if (!token) { return response.status(401).json({ error: 'Unauthorized' }); }
        const keyID = await redisClient.get(`auth_${token}`);
        if (!keyID) { return response.status(401).json({ error: 'Unauthorized' }); }
        const user = await dbClient.db.collection('users').findOne({ _id: ObjectID(keyID) });
        if (!user) { return response.status(401).json({ error: 'Unauthorized' }); }

        const idFile = request.params.id || '';
        const fileDocument = await dbClient.db
            .collection('files')
            .findOne({ _id: ObjectID(idFile), userId: user._id });
        if (!fileDocument) return response.status(404).send({ error: 'Not found' });

        return response.send({
            id: fileDocument._id,
            userId: fileDocument.userId,
            name: fileDocument.name,
            type: fileDocument.type,
            isPublic: fileDocument.isPublic,
            parentId: fileDocument.parentId,
        });
    }

    // GET /files
    // Return the files attached to the user
    static async getIndex(request, response) {
        // Retrieve the user based on the token
        const token = request.headers['x-token'];
        if (!token) { return response.status(401).json({ error: 'Unauthorized' }); }
        const keyID = await redisClient.get(`auth_${token}`);
        if (!keyID) { return response.status(401).json({ error: 'Unauthorized' }); }
        const parentId = request.query.parentId || '0';
        const pagination = request.query.page || 0;
        const user = await dbClient.db.collection('users').findOne({ _id: ObjectID(keyID) });
        if (!user) response.status(401).json({ error: 'Unauthorized' });

        const aggregationMatch = { $and: [{ parentId }] };
        let aggregateData = [
            { $match: aggregationMatch },
            { $skip: pagination * 20 },
            { $limit: 20 },
        ];
        if (parentId === 0) aggregateData = [{ $skip: pagination * 20 }, { $limit: 20 }];

        const files = await dbClient.db
            .collection('files')
            .aggregate(aggregateData);
        const filesArray = [];
        await files.forEach((item) => {
            const fileItem = {
                id: item._id,
                userId: item.userId,
                name: item.name,
                type: item.type,
                isPublic: item.isPublic,
                parentId: item.parentId,
            };
            filesArray.push(fileItem);
        });

        return response.send(filesArray);
    }
}

module.exports = FilesController;