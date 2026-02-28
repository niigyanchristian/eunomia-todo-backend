# ToDo Backend API

A RESTful API backend for a ToDo application built with Node.js and Express.

## Project Structure

```
.
├── src/
│   ├── index.js       # Main Express application entry point
│   ├── db.js          # Database connection and setup
│   ├── routes/        # API route handlers
│   └── middleware/    # Custom middleware functions
├── package.json       # Project dependencies and scripts
└── README.md          # This file
```

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

1. Clone the repository and navigate to the project directory

2. Install dependencies:
   ```bash
   npm install
   ```

### Available Scripts

- `npm start` - Start the production server (runs `node src/index.js`)
- `npm run dev` - Start the development server with auto-reload (runs `nodemon src/index.js`)
- `npm test` - Run tests with Jest and generate coverage report

## Running the Application

### Development Mode
```bash
npm run dev
```

The server will start on `http://localhost:3000` (or the port specified in PORT environment variable).

### Production Mode
```bash
npm start
```

## API Endpoints

- `GET /` - Returns a welcome message
- `GET /health` - Health check endpoint

## Environment Variables

Create a `.env` file in the root directory for environment-specific configuration:

```
PORT=3000
```

## Development

The project uses:
- **Express** - Web framework
- **Nodemon** - Auto-reload during development
- **Jest** - Testing framework
- **ESLint** - Code linting

## License

ISC
