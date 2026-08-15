import mongoose from "mongoose";

const ConnectDB = async () => {
  const connectionInstance = await mongoose.connect(
    `${process.env.MONGODB_URI}/${process.env.DB_NAME}`
  );
  console.log("MONGODB connected! db host:", connectionInstance.connection.host);
  return connectionInstance;
};

export default ConnectDB;
