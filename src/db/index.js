import mongoose from "mongoose";

const ConnectDB = async ()=>{
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${process.env.DB_NAME}`);
        console.log("MONGODB connected! db host:",connectionInstance.connection.host);
        
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

export default ConnectDB;