import dotenv from 'dotenv/config';
// dotenv.config();

import app from './app.js';
import connectDB from './config/db.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`Ad Pilot Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });

};

startServer();