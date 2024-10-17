import express from 'express';
import Routes from './routes/index';

const app = express();
const port = process.env.PORT || 5000; // sets sever to listen on port 5000

app.use(express.json()); // sets middleware
Routes(app);

// starts the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

export default app;