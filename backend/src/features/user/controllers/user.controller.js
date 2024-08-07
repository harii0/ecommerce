import { v2 as cloudinary } from 'cloudinary';
import 'dotenv/config';
import jwt from 'jsonwebtoken';
import uploadFile from '../../../utils/cloudinary.js';
import User from '../models/user.model.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import { ApiError } from '../../../utils/ApiError.js';
import { ApiResponse } from '../../../utils/ApiResponse.js';
import sendMail from '../../../utils/sendMail.js';
import bcrypt from 'bcrypt';
import Order from '../../order/models/order.model.js';
import UserReview from '../models/review.model.js';
import userSchema from '../../../validators/userSchema.js';

//create user
const registerUser = asyncHandler(async (req, res) => {
  const { error, value } = userSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }
  const { username, email, password } = value;

  const userExist = await User.findOne({ email });

  if (userExist) {
    throw new ApiError(409, 'User already exists');
  }

  try {
    const user = await User.create({ username, email, password });

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save();
    const options = {
      httpOnly: true,
      secure: true,
    };
    const refreshOptions = {
      httpOnly: true,
      secure: true,
    };
    return res
      .status(201)
      .cookie('accessToken', accessToken, options)
      .cookie('refreshToken', refreshToken, refreshOptions)
      .json(
        new ApiResponse(201, {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
          },
        }),
      );
  } catch (error) {
    throw new ApiError(500, 'Internal server error');
  }
});
//login user
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email && !password) {
    throw new ApiError(400, 'Please add all fields');
  }
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid credentials');
  }
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
  const options = {
    httpOnly: true,
    secure: true,
  };
  const refreshOptions = {
    httpOnly: true,
    secure: true,
    // path: '/refresh_token',
  };
  return res
    .status(200)
    .cookie('accessToken', accessToken, options)
    .cookie('refreshToken', refreshToken, refreshOptions)
    .json(
      new ApiResponse(
        200,
        {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
          },
        },
        'Logged in successfully',
      ),
    );
});
//logout user
const logoutUser = asyncHandler(async (req, res) => {
  const loggedOutUser = await User.findByIdAndUpdate(
    req.user.id,
    {
      $set: {
        refreshToken: null,
      },
    },
    { new: true },
  );

  const options = {
    httpOnly: true,
  };
  return res
    .status(200)
    .clearCookie('accessToken', options)
    .clearCookie('refreshToken')
    .json(new ApiResponse(200, {}, 'Logged out successfully'));
});
//refreshToken
const refreshToken = asyncHandler(async (req, res) => {
  const userRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
  if (!userRefreshToken) {
    throw new ApiError(401, 'Please provide refresh token');
  }

  try {
    let payload = jwt.verify(userRefreshToken, process.env.JWT_REFRESH_TOKEN);
    const user = await User.findById(payload.id);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    if (user?.refreshToken !== userRefreshToken) {
      throw new ApiError(401, 'Invalid refresh token or token mismatch');
    }
    const accessToken = user.generateAccessToken();
    const options = {
      httpOnly: true,
      secure: true,
    };
    const refreshToken = user.generateRefreshToken();
    const refreshOptions = {
      httpOnly: true,
      secure: true,
      // path: '/refresh_token',
    };
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return res
      .status(200)
      .cookie('accessToken', accessToken, options)
      .cookie('refreshToken', refreshToken, refreshOptions)
      .json(new ApiResponse(200, { accessToken }, 'Refreshed successfully'));
  } catch (error) {
    throw new ApiError(401, 'Invalid refresh token Please Log in again');
  }
});
//update user
const updateUser = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { username, email } = req.body;
  const avatar = req.file ? req.file.path : null;
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  let avatarUrl = null;
  if (avatar) {
    if (user.avatar) {
      const publicId = 'uploads/' + user.avatar.split('/').pop().split('.')[0];

      await cloudinary.uploader.destroy(publicId, () => {
        console.log('deleted');
      });
    }
    const result = await uploadFile(avatar);

    if (result && result.secure_url) {
      avatarUrl = result.secure_url;
    }
  }

  user.username = username || user.username;
  user.email = email || user.email;
  user.avatar = avatarUrl || user.avatar;

  await user.save();
  return res
    .status(200)
    .json(new ApiResponse(200, { user }, 'User updated successfully'));
});
//forgot password
const forgotPassword = asyncHandler(async (req, res) => {
  //email through body
  const email = req.body.email;
  //check if email exists
  if (!email) {
    throw new ApiError(400, 'Please provide email');
  }
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  //generate token
  const resetToken = user.generateResetToken();
  await user.save();
  //send email with token
  const resetUrl = `http://localhost:5173/reset-password?token=${resetToken}`;
  const message = `Click here to reset your password: ${resetUrl}`;

  sendMail(email, 'Reset Password', message);
  return res.status(200).json(new ApiResponse(200, {}, 'Email sent'));
});
//reset password
const resetPassword = asyncHandler(async (req, res) => {
  const password = req.body.password;
  const user = req.user;
  if (!password) {
    throw new ApiError(400, 'Please provide password');
  }
  const hashedPassword = bcrypt.hashSync(password, 8);
  user.password = hashedPassword;
  user.resetPasswordToken = null;
  user.resetPasswordExpire = null;
  await user.save();
  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Password reset successfully'));
});
//protect routes
const getUserProfile = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  const profile = {
    id: user._id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    wishlist: user.wishlist,
    cart: user.cart,
    orderHistory: user.orderHistory,
  };
  return res.status(200).json(new ApiResponse(200, { profile }, 'Profile'));
});

//get wishlist
const getUserWhislist = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  if (!userId) {
    throw new ApiError(400, 'cant find user id');
  }
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(401, 'cant fetch user');
  }
  const wishlist = user.wishlist;
  return res.status(200).json(new ApiResponse(200, { wishlist }, 'wishlist'));
});
//rate product
const rateProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { rating, reviewText } = req.body;
  const userId = req.user.id;
  if (!prodId || !rating) {
    throw new ApiError(400, 'Missing required fields');
  }
  const hasPurchased = await Order.findOne({
    userId,
    productId,
    status: { $in: ['delivered'] },
  });
  if (!hasPurchased) {
    return null;
  }
  const existingReview = await UserReview.findOne({ userId, prodId });
  let newReview;
  if (!existingReview.rating == 0) {
    existingReview.rating = rating;
    newReview = await UserReview.save();
  } else {
    newReview = new UserReview({ productId, userId, rating, reviewText });
    newReview = await UserReview.save();
  }
});

export {
  registerUser,
  getUserProfile,
  updateUser,
  loginUser,
  logoutUser,
  forgotPassword,
  refreshToken,
  resetPassword,
  getUserWhislist,
  rateProduct,
};
