import { User } from "../models/user.model.js"
import asyncHandler from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import JWT from "jsonwebtoken"
import mongoose from "mongoose";


const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = await user.generateAccessToken()
        const refreshToken = await user.generateRefreshToken()

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "error while creating tokens")
    }
}

const register = asyncHandler(
    async (req, res) => {
        const { username, password, email, fullName } = req.body;

        if ([username, password, email, fullName].some(item => item?.trim() === "")) {
            throw new ApiError(400, "all fields are required");
        }

        const existedUser = await User.findOne(
            {
                $or: [{ username }, { email }]
            }
        )

        if (existedUser) {
            throw new ApiError(400, "email or username already exist")
        }

        // const avatarFilePath = req.files?.avatar[0]?.path;
        // if (!avatarFilePath) {
        //     throw new ApiError(400, "avatar required")
        // }

        let avatarFilePath;
        if (req.files && Array.isArray(req.files.avatar) && req.files.avatar.length > 0) {
            avatarFilePath = req.files?.avatar[0]?.path;
        }

        // const coverImagePath = req.files?.coverImage[0]?.path;
        let coverImagePath;
        if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
            coverImagePath = req.files?.coverImage[0]?.path;
        }

        const avatar = await uploadOnCloudinary(avatarFilePath)
        const coverImage = await uploadOnCloudinary(coverImagePath)

        console.log(req.files);

        const user = await User.create(
            {
                username: username.toLowerCase(),
                password,
                email,
                fullName,
                avatar: avatar?.url || "https://res.cloudinary.com/dhfoe5edd/image/upload/v1713796296/rcczelsv3zn88aqcum2c_c_crop_ar_1_1_k06k3g.jpg",
                coverImage: coverImage?.url || ""
            }
        )

        const createdUser = await User.findOne(
            { _id: user._id }
        ).select(" -password -refreshToken ");

        if (!createdUser) {
            throw new ApiError(500, "something went wrong while register");
        }

        console.log(createdUser);
        res.status(200).json(new ApiResponse(200, createdUser, "user registered successfully"));
    }
)

const login = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }
    if (!password) {
        throw new ApiError(400, "password is required")
    }

    const user = await User.findOne({
    $or: [
      { email: email?.toLowerCase() }, 
      { username: username }
    ]
  });

    if (!user) {
        throw new ApiError(400, "user doesnot exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(400, "invalid password")
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id).select(" -password -refreshToken ");

    const options = {
        httpOnly: true,
        secure: true,
        sameSite: 'None'      
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(200, loggedInUser, "user logged in successfully"))

})

const logout = asyncHandler(async (req, res) => {

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: [{ refreshToken: 1 }]
        },
        { new: true }
    );

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, user, `${user.username} has logged out`))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incommingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incommingRefreshToken) {
        throw new ApiError(401, "unauthorized user")
    }

    try {

        const decodedToken = JWT.verify(incommingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiError(404, "user does not exist");
        }

        if (incommingRefreshToken != user.refreshToken) {
            throw new ApiError(401, "refresh token is expired or used")
        }

        const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

        const options = {
            httpOnly: true,
            secure: true
        }

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(new ApiResponse(201,
                {
                    accessToken,
                    refreshToken
                },
                "access token refreshed successfully"
            ))

    } catch (error) {
        throw new ApiError(400, error?.message || "invalid refresh token");
    }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        throw new ApiResponse(401, "all fields are required")
    }

    const user = await User.findById(req.user);
    console.log(user);

    const isPasswordValid = await user.isPasswordCorrect(currentPassword);
    if (!isPasswordValid) {
        throw new ApiError(400, "current password is incorrect");
    }

    user.password = newPassword;
    user.save({ validateBeforeSave: false })

    return res.status(200).json(new ApiResponse(200, {}, "password updated successfully"));
})


const getCurrentUser = asyncHandler(async(req,res)=>{
    
    const loggedInUser = await User.findById(req.user?._id)
    .select(" -password -refreshToken ");

    return res.status(200).json(new ApiResponse(200,loggedInUser,"current user fetched"));
})


const updateUserDetail = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;
    if (!fullName && !email) {
        throw new ApiError(400, "enter fields to update")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                fullName,
                email
            }
        },
        {
            new: true
        }
    )

    if (!user) {
        throw new ApiError(500, "error while updating User details")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, user, "account updated"))
})

const updateAvatar = asyncHandler(async (req, res) => {

    console.log("req file ----- ", req.file);
    const avatarFilePath = req.file?.path;

    if (!avatarFilePath) {
        throw new ApiError(400, "upload avatar picture to update")
    }

    const avatar = await uploadOnCloudinary(avatarFilePath);
    console.log(avatar);

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {
            new: true
        }
    )

    console.log(user);

    return res
        .status(200)
        .json(new ApiResponse(200, user, "avatar updated successfully"))

})

const getUserChannelDetails = asyncHandler(async (req, res) => {
    const { username } = req.params;

    if (!username) {
        throw new ApiError(400, "Username is required")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedChannels"
            }
        },
        {
            $lookup: {
                from: "subsciptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                subscribedChannelCount: {
                    $size: "$subscribedChannels"
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                username: 1,
                fullName: 1,
                avatar: 1,
                coverImage: 1,
                isSubscribed: 1,
                subscribersCount: 1,
                subscribedChannelCount: 1,
                email: 1
            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(400, "channel does not exist")
    }

    console.log(channel);

    return res.status(200).json(new ApiResponse(200, channel[0], "user channel fetched"))

})

const getWatchHistory = asyncHandler(async (req, res) => {

    const history = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        username:1,
                                        avatar:1,
                                        fullName:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first:"$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    if(!history){
        throw new ApiError(400,"cant fetch watch history")
    }

    console.log(history);

    return res
    .status(200)
    .json(new ApiResponse(200,history,"watch history fetched"));

})

const updateCoverImage = asyncHandler(async (req, res) => {
    const coverImagePath = req.file?.path;

    if (!coverImagePath) {
        throw new ApiError(400, "upload cover image to update")
    }

    const coverImage = await uploadOnCloudinary(coverImagePath);

    if (!coverImage) {
        throw new ApiError(500, "error while uploading cover image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {
            new: true
        }
    )

    return res
        .status(200)
        .json(new ApiResponse(200, user, "cover image uploaded successfully"));

})

export {
    register,
    login,
    generateAccessAndRefreshToken,
    logout,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateUserDetail, 
    updateAvatar,
    updateCoverImage,
    getUserChannelDetails,
    getWatchHistory
}
