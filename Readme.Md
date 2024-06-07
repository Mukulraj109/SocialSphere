# SocialSphere App Backend
This is learning project for backend development.

## Table of Contents
- [Description](#description)
- [User-Management](#user-management)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Contributing](#contributing)
- [Tests](#tests)
- [Questions](#questions)

## Description
SocialSphere is a robust backend built with Node.js, Express.js, and MongoDB, designed to power a social media-like platform. This backend handles various operations, providing a solid foundation for a future full-stack social media application.
It includes user controllers that manage registration, login, logout, and other user-related functionalities. The video controller allows users to perform CRUD operations on videos. Similarly, users can create, read, update, and delete comments and community post. The like controller enables users to like videos, comments, and community, enhancing user interaction and engagement. Additionally, a dashboard controller provides an overview of user activities and interactions. This backend serves as a solid foundation for a future frontend, paving the way for a full-stack social media application.

## User Management

-Registration: Allows new users to create accounts.
-Login: Secure user authentication.
-Logout: User session management.
-User Profiles: Manage user-related  functionalities such as updating   profiles.

## Prerequisites

Before you begin, ensure you have met the following requirements:

- You have installed the latest version of Node.js and npm.
- You have a Windows/Linux/Mac machine.
- You have read guide to Express.js.
- You have a basic understanding of JavaScript and MongoDB.
- You have MongoDB installed or have a MongoDB Atlas account.

## Installation


Follow these steps to get the project set up on your local machine:

1. **Clone the repository**: First, you will need to clone the repository to your local machine. You can do this with the following command:

   ```https://github.com/Mukulraj109/SocialSphere.git```
   
2. **Navigate to the project directory**: Change your current directory to the project's directory:

    ```bash
    cd SOCIALSPHERE
    ```
3. **Install the dependencies**: Now, you can install the necessary dependencies for the project:

    ```bash
    npm install
    npm install -g nodemon
    npm install dotenv cloudinary mongoose mongoose-aggregate-paginate-v2 bcrypt jsonwebtoken express cors cookie-parser cloudinary multer

    ```
4. **Set up environment variables**: Copy the `.env.example` file and rename it to `.env`. Then, fill in the necessary environment variables.

5. **Start the server**: Finally, you can start the server:

    ```bash
    npm run dev
    ```

Now, you should be able to access the application at `http://localhost:8000` (or whatever port you specified).

## Usage

This project is a backend application, so you'll interact with it using API endpoints. Here are some examples:


**User Registration**

To register a new user, send a POST request to `/api/v1/users/register` with the following data:

```json
{
  "username": "example",
  "email": "example@email.com",
  "password": "examplepassword",
  "fullName": "Example User",
  "avatar": "avatar.jpg",
  "coverImage": "coverImage.jpg",
}


```

**User Login**

To login, send a POST request to `/api/v1/users/login` with the following data:

```json
{
  "email": "example@email",
  "password": "examplepassword"
}
```

**User Logout**

To logout, send a POST request to `/api/v1/users/logout` .

There a lot of endpoint you can see in routes.

## Tests
This project uses Postman for testing its API endpoints. 
here is a postman collection import in your postman collection and set the environment variables.
variable : vidtube  initialValue : http://localhost:8000/api/v1/  currentValue : http://localhost:8000/api/v1/

import this file in postman collection.: ## Tests
This project uses Postman for testing its API endpoints. 
here is a postman collection import in your postman collection and set the environment variables.
variable : vidtube  initialValue : http://localhost:8000/api/v1/  currentValue : http://localhost:8000/api/v1/

import this file in postman collection.: https://drive.google.com/file/d/1BNLm9WSyGugKT-66TxpKglWaaOob4Hkz/view?usp=sharing

The tests cover the following areas:

- User registration, login, and logout
- Video CRUD operations
- Comment CRUD operations
- Community CRUD operations
- Liking videos, comments, and Community
- Dashboard functionality

Please note that you'll need to update the environment variables in Postman to match your local setup (e.g., `base_url`, `user_token`).


The tests cover the following areas:

- User registration, login, and logout
- Video CRUD operations
- Comment CRUD operations
- Community CRUD operations
- Liking videos, comments, and Community
- Dashboard functionality

Please note that you'll need to update the environment variables in Postman to match your local setup (e.g., `base_url`, `user_token`).

## Questions

If you have any questions or feedback, please feel free to reach out to me via [GitHub](https://github.com/Mukulraj109/SocialSphere).

