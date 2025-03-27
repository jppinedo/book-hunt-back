# BookHuntServer Backend

## Overview

The `BookHuntServer` project is a Node.js backend built with the Express framework. It serves as the backend for the BookHunt application, providing APIs to interact with external services like eBay. The backend is responsible for handling requests from the front-end, processing data, and communicating with third-party APIs.

### Key Features
- **eBay API Integration**: Provides endpoints to search for items and retrieve item details from eBay.
- **Express Framework**: A lightweight and flexible Node.js framework for building web applications.
- **Environment Configuration**: Uses `dotenv` for managing environment variables.
- **CORS Support**: Ensures secure cross-origin requests between the front-end and backend.

## Technologies Used
- **Node.js**: JavaScript runtime for building scalable server-side applications.
- **Express**: Web framework for creating RESTful APIs.
- **Axios**: HTTP client for making requests to external APIs.
- **dotenv**: For managing environment variables.
- **CORS**: Middleware for handling cross-origin requests.

## Prerequisites
Before starting the backend, ensure you have the following installed:
- **Node.js**: Version 14.x or higher. Download from [nodejs.org](https://nodejs.org/).
- **npm**: Comes bundled with Node.js. Verify installation with `npm -v`.
- **Git**: Optional, for cloning the repository.

## Setup Instructions

1. **Clone the Repository** (if not already cloned):
   ```bash
   git clone https://github.com/jppinedo/book-hunt-back.git
   cd BookHuntServer
2. **Install Dependencies**

    Run the following command in the `BookHuntServer` directory to install the required dependencies:
    ```bash
    npm install
    ```
3. **Configure Environment Variables**

    Create a `.env` file in the `BookHuntServer` directory and add the necessary environment variables. Refer to the `.env` file in the front-end for values like `VITE_BACKEND_URL` and `VITE_LOCAL_BACKEND_URL`.

4. **Start the Server** 

    Use the following command to start the backend server:
    ```bash
    npm start
    ```

    By default, the server will run on `http://localhost:5001`.

5. **Verify the Server** 

    Open a browser or use a tool like Postman to test the endpoints. For example:

- `GET http://localhost:5001/api/ebay/item/:itemId`
- `GET http://localhost:5001/api/ebay/search?query=book&limit=10&offset=0`

## API Endpoints
### 1. Get eBay Item

- **Endpoint:** `/api/ebay/item/:itemId`
- **Method:** GET
- **Description:** Retrieves details of a specific item from eBay.
- **Headers:** Requires an `Authorization` token.

### 2. Search eBay
- **Endpoint:** `/api/ebay/search`
- **Method:** GET
- **Description:** Searches for items on eBay based on a query, limit, and offset.
- **Headers:** Requires an `Authorization` token.
- **Query Parameters:**
    - `query`: Search term.
    - `limit`: Number of results to return.
    - `offset`: Pagination offset.
