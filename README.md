# SmartMarketAI

<p align="center">

![React](https://img.shields.io/badge/React-19-blue?logo=react)
![Node.js](https://img.shields.io/badge/Node.js-20-green?logo=node.js)
![Express](https://img.shields.io/badge/Express.js-Backend-black?logo=express)
![JWT](https://img.shields.io/badge/Auth-JWT-orange)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38BDF8?logo=tailwindcss)
![Status](https://img.shields.io/badge/Status-Under_Development-yellow)
![License](https://img.shields.io/badge/License-MIT-blue)

</p>

A full-stack **multi-vendor e-commerce platform** designed for handmade products with an integrated **JavaScript-based LSTM demand forecasting system**. SmartMarketAI enables customers to shop from multiple vendors while helping vendors make inventory decisions using historical sales data and AI-assisted demand forecasting.

Unlike traditional marketplace projects, SmartMarketAI focuses on inventory intelligence by combining order management with machine learning–based demand prediction, allowing vendors to estimate future demand and plan stock replenishment more effectively.

---

## Repository

**Repository**

https://github.com/kishan-thamban/smartmarket-ai

---

# Table of Contents

- Overview
- Features
- Technology Stack
- System Architecture
- Project Structure
- Installation
- Environment Variables
- Authentication
- Forecasting System
- Database Design
- API Overview
- Security Features
- Future Improvements
- Known Limitations
- Contributing
- License

---

# Overview

Small-scale handmade product sellers often struggle with inventory planning because they have limited access to demand forecasting tools.

SmartMarketAI addresses this problem by providing an online marketplace where:

- Customers can browse and purchase handmade products.
- Vendors can manage products, inventory, and orders.
- Administrators can monitor vendors and platform activity.
- A JavaScript-based LSTM forecasting model predicts future demand using historical sales data.

Each completed order contributes to a product's sales history. Vendors can then generate a demand forecast that estimates future sales and recommends reorder quantities based on predicted demand and current stock.

The project was developed as a **Final Year Engineering Project** to demonstrate concepts in:

- Full-stack web development
- Authentication and authorization
- REST API design
- Database abstraction
- Machine learning fundamentals
- Inventory management
- Software architecture

---

# Key Features

## Customer

- User registration and login
- Secure JWT authentication
- Browse products from multiple vendors
- Search, filter and sort products
- Shopping cart management
- Multi-step checkout process
- Client-side payment form validation
- Stock availability verification before order placement
- Order history

---

## Vendor

- Vendor registration
- Product management (Create, Read, Update, Delete)
- Inventory management
- Sales history tracking
- Order management
- Demand forecasting dashboard
- Inventory reorder recommendations
- Forecast visualization using Recharts
- Forecast accuracy metrics

---

## Administrator

- Vendor approval management
- Platform statistics dashboard
- Commission management
- Vendor monitoring
- Marketplace administration

---

# Technology Stack

| Layer | Technology |
|---------|------------|
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| Routing | React Router |
| Charts | Recharts |
| Backend | Node.js |
| Server | Express.js |
| Authentication | JWT |
| Password Hashing | bcrypt |
| Database | JSON Database (`db.json`) |
| Database Layer | Custom Database Abstraction |
| Machine Learning | Pure JavaScript LSTM |
| Version Control | Git & GitHub |

---

# System Architecture

```

                +----------------------+
                |      Customer        |
                +----------------------+
                           |
                +----------------------+
                |       Vendor         |
                +----------------------+
                           |
                +----------------------+
                |       Admin          |
                +----------------------+
                           |
                           ▼
               React Frontend (Vite)
                           |
                    JWT Authentication
                           |
                           ▼
                Express.js REST API
                           |
        +------------------+------------------+
        |                                     |
        ▼                                     ▼
Database Abstraction Layer            Forecast Engine
(json-adapter.js)                     (JavaScript LSTM)
        |                                     |
        +------------------+------------------+
                           |
                           ▼
                      db.json Database

```

---

# Project Structure

```

SmartMarketAI
│
├── src/
│ ├── components/
│ ├── pages/
│ ├── context/
│ ├── assets/
│ ├── utils/
│ ├── App.jsx
│ └── main.jsx
│
├── backend/
│ ├── db/
│ │ ├── index.js
│ │ └── json-adapter.js
│ │
│ ├── ml/
│ │ └── lstm.js
│ │
│ ├── server.js
│ ├── package.json
│ └── db.json
│
├── public/
├── package.json
├── vite.config.js
└── README.md

```

---

# Highlights

- Full-stack React + Express application
- Multi-vendor marketplace
- JWT-based authentication
- Role-based authorization
- Password hashing using bcrypt
- Custom JavaScript LSTM implementation
- Database abstraction layer for future MongoDB migration
- Inventory recommendation system
- Interactive demand forecasting charts
- Clean and modular project architecture

---
# Installation

## Prerequisites

Before running the project, ensure you have the following installed:

- Node.js 20 or later
- npm (comes with Node.js)
- Git

Verify your installation:

```bash
node -v
npm -v
```

---

## Clone the Repository

```bash
git clone https://github.com/kishan-thamban/smartmarket-ai.git
cd smartmarket-ai
```

---

## Backend Setup

Navigate to the backend directory.

```bash
cd backend
```

Install dependencies.

```bash
npm install
```

Create a `.env` file using the provided template.

```bash
cp .env.example .env
```

Update the required environment variables.

Start the backend server.

```bash
npm run dev
```

The backend runs on:

```
http://localhost:5000
```

---

## Frontend Setup

Open a new terminal.

Navigate to the project root.

Install frontend dependencies.

```bash
npm install
```

Start the React development server.

```bash
npm run dev
```

The frontend runs on:

```
http://localhost:3000
```

The Vite development server proxies API requests to the backend during development.

---

# Environment Variables

Create a file named:

```
backend/.env
```

Example:

```env
JWT_SECRET=your_secure_jwt_secret

PORT=5000

FRONTEND_ORIGIN=http://localhost:3000
```

## Environment Variable Description

| Variable | Description |
|-----------|-------------|
| JWT_SECRET | Secret key used to sign and verify JWT tokens |
| PORT | Backend server port |
| FRONTEND_ORIGIN | Allowed frontend origin for CORS |

> **Important**
>
> Never commit your `.env` file to GitHub.

---

# Running the Application

Start the backend first.

```bash
cd backend
npm run dev
```

Open another terminal.

Start the frontend.

```bash
npm run dev
```

Visit:

```
http://localhost:3000
```

---

# User Roles

SmartMarketAI supports three user roles.

| Role | Description |
|------|-------------|
| Customer | Purchase handmade products |
| Vendor | Manage products, inventory and orders |
| Admin | Manage vendors and monitor the platform |

Each role has its own dashboard and protected routes.

---

# Authentication & Authorization

Authentication is implemented using **JSON Web Tokens (JWT)**.

Passwords are securely hashed using **bcrypt** before being stored.

The authentication process follows these steps:

```
User Login
      │
      ▼
Validate Credentials
      │
      ▼
bcrypt Password Verification
      │
      ▼
Generate JWT
      │
      ▼
Store Token (localStorage)
      │
      ▼
Protected API Requests
      │
      ▼
verifyToken Middleware
      │
      ▼
Role Authorization
```

---

## Login Flow

1. User enters email and password.
2. Backend validates the credentials.
3. Password is verified using bcrypt.
4. A signed JWT is generated.
5. The token is returned to the client.
6. The frontend stores the token.
7. Protected requests include:

```
Authorization: Bearer <JWT_TOKEN>
```

8. Every protected request is validated before accessing the requested resource.

---

## Route Protection

### Frontend

Protected pages require a valid JWT.

Users attempting to access unauthorized pages are redirected to the login page.

Examples include:

- Vendor Dashboard
- Admin Dashboard
- Checkout
- Cart
- Marketplace (authenticated functionality)

---

### Backend

Protected API routes use authentication middleware to:

- Verify JWT authenticity
- Check token expiration
- Validate user role
- Prevent unauthorized access

Role-based authorization ensures users can only access resources permitted for their account type.

---

# Security Features

SmartMarketAI incorporates several security practices.

### Password Hashing

Passwords are hashed using **bcrypt** before storage.

Plain-text passwords are never stored.

---

### JWT Authentication

Authentication is stateless using signed JWT tokens.

Only authenticated users can access protected endpoints.

---

### Role-Based Access Control

Access permissions are enforced for:

- Customer
- Vendor
- Admin

This prevents unauthorized access to administrative and vendor resources.

---

### Protected API Routes

Protected endpoints verify:

- Authentication
- User role
- Resource ownership (where applicable)

before processing requests.

---

### Secure Password Storage

Sensitive credentials are never returned in API responses.

---

### Rate Limiting

The backend applies request rate limiting to reduce abuse and excessive API requests.

---

### HTTP Security

Security middleware is used to improve application security through secure HTTP headers and controlled cross-origin requests.

---

# Demo Accounts

An administrator account is automatically created during the initial setup.

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@smartmarket.ai | admin123 |

Vendor and Customer accounts can be created using the registration page.

---


# Forecasting System

One of the key features of SmartMarketAI is its demand forecasting module, which helps vendors estimate future product demand based on historical sales data.

Unlike traditional inventory management systems, SmartMarketAI records product sales over time and uses this data to generate demand forecasts and inventory recommendations.

---

## Forecast Workflow

```text
Completed Order
        │
        ▼
Sales History Updated
        │
        ▼
Vendor Requests Forecast
        │
        ▼
GET /api/forecast/:productId
        │
        ▼
Retrieve Product Sales History
        │
        ├──────────────┐
        │              │
        ▼              ▼
Less than          14 or more
14 records         records
        │              │
        ▼              ▼
Exponential      JavaScript
Smoothing        LSTM Model
        │              │
        └──────┬───────┘
               ▼
Generate Forecast
               │
               ▼
Return Chart Data,
Forecast Metrics,
and Recommended Stock
```

---

## LSTM Forecasting

The primary forecasting model is a lightweight Long Short-Term Memory (LSTM) neural network implemented entirely in JavaScript.

The model learns sequential sales patterns from historical sales records and predicts future demand for each product.

The forecasting response includes:

- Historical sales data
- Predicted demand
- Confidence intervals
- Forecast accuracy metrics
- Total predicted demand

If sufficient historical sales data is available, the JavaScript LSTM model is used to generate the forecast.

---

## Exponential Smoothing Fallback

Machine learning models require sufficient historical data to produce meaningful forecasts.

When a product has fewer than 14 historical sales records, SmartMarketAI automatically switches to an Exponential Smoothing algorithm.

This ensures that new products can still receive demand estimates without requiring large datasets.

---

## Forecast Metrics

Forecast results include commonly used evaluation metrics:

| Metric | Purpose |
|---------|----------|
| RMSE | Measures average prediction error in original units |
| MAPE | Measures percentage prediction error |

These metrics help vendors understand the reliability of generated forecasts.

---

## Inventory Recommendation

After forecasting demand, SmartMarketAI estimates the quantity that should be reordered.

The recommendation is based on the relationship between predicted demand and the product's current inventory.

```text
Recommended Reorder Quantity

=

Maximum

(

0,

Predicted Demand

−

Current Stock

)
```

This prevents negative reorder quantities while helping vendors identify products that require replenishment.

---

# Database Design

SmartMarketAI currently uses a JSON-based database for simplicity during development.

All data is stored in:

```text
backend/db.json
```

To improve maintainability and simplify future migration, all database operations pass through a dedicated database abstraction layer rather than accessing the JSON file directly.

---

## Database Collections

The application stores information for:

- Users
- Vendors
- Products
- Orders
- Sales History
- Shopping Carts
- Platform Statistics

---

## Database Abstraction Layer

Instead of allowing application code to read and write directly to `db.json`, SmartMarketAI introduces a database abstraction layer.

```text
Application

      │

      ▼

Database Layer

(db/index.js)

      │

      ▼

JSON Adapter

(json-adapter.js)

      │

      ▼

db.json
```

This design separates business logic from storage logic.

As a result, migrating from the current JSON database to MongoDB will require minimal changes to the application code.

---

## Why Use a Database Abstraction Layer?

Benefits include:

- Better code organization
- Easier maintenance
- Improved scalability
- Reduced code duplication
- Simplified database migration
- Cleaner separation of concerns

---

# API Overview

The backend follows RESTful API principles.

Endpoints are grouped according to application modules.

| Module | Purpose |
|---------|----------|
| Authentication | User login and registration |
| Products | Product management |
| Orders | Order processing |
| Cart | Shopping cart management |
| Forecast | Demand forecasting |
| Inventory | Inventory recommendations |
| Vendors | Vendor management |
| Admin | Platform administration |

Most endpoints exchange JSON data between the frontend and backend.

Protected routes require a valid JWT token.

---

## Authentication Header

Protected requests include:

```http
Authorization: Bearer <JWT_TOKEN>
```

The backend validates every protected request before processing it.

---

# Order Processing Workflow

When a customer places an order, SmartMarketAI performs multiple validation steps before confirming the purchase.

```text
Customer Checkout
        │
        ▼
Validate JWT
        │
        ▼
Validate Cart
        │
        ▼
Check Product Stock
        │
        ▼
Create Order
        │
        ▼
Update Inventory
        │
        ▼
Update Sales History
        │
        ▼
Update Vendor Statistics
        │
        ▼
Generate Future Forecast Data
```

This workflow ensures that inventory levels remain consistent while keeping forecasting data up to date.

---

# Frontend Architecture

The frontend is developed using React and follows a component-based architecture.

Major modules include:

- Authentication
- Marketplace
- Shopping Cart
- Checkout
- Vendor Dashboard
- Admin Dashboard
- Shared Components
- Context API

Reusable components improve maintainability while reducing duplicated code.

---

# Backend Architecture

The backend follows a modular Express.js architecture.

Key components include:

- REST API
- Authentication Middleware
- Role Authorization
- Database Layer
- Forecast Engine
- Business Logic
- Inventory Management

Each module has a clearly defined responsibility, making the application easier to extend and maintain.
# Future Improvements

SmartMarketAI has been designed with future scalability in mind. Several enhancements are planned to improve functionality, scalability, and forecasting performance.

## Database Migration

The current implementation uses a JSON-based database for simplicity during development.

A future version will migrate to **MongoDB Atlas**, allowing:

- Improved scalability
- Better concurrent data access
- Cloud-based data storage
- Improved performance for larger datasets

Thanks to the existing database abstraction layer, this migration can be completed with minimal changes to the application logic.

---

## Model Persistence

Currently, the LSTM model is trained whenever a forecast is requested.

Future versions will:

- Save trained model weights
- Reload trained models instead of retraining
- Reduce forecast generation time
- Improve consistency between predictions

---

## Improved Forecasting

Potential improvements include:

- Seasonal demand analysis
- Holiday-aware forecasting
- Multiple forecasting algorithms
- Automatic model selection
- Hyperparameter optimization
- Forecast comparison dashboard

---

## Cloud Deployment

The application is intended to be deployed using:

| Component | Planned Platform |
|-----------|------------------|
| Frontend | Vercel |
| Backend | Render |
| Database | MongoDB Atlas |

---

## Payment Integration

The current checkout demonstrates the purchase workflow using client-side validation.

Future versions may integrate payment gateways such as:

- Razorpay
- Stripe
- PayPal

---

## Image Uploads

Instead of external image URLs, vendors will be able to upload product images directly using cloud storage services such as:

- Cloudinary
- Firebase Storage
- AWS S3

---

## Analytics Dashboard

Future releases may include:

- Revenue analytics
- Customer insights
- Product performance reports
- Sales trends
- Inventory turnover
- Vendor performance metrics

---

# Known Limitations

The current implementation is intended for academic demonstration and learning purposes.

## JSON Database

The application currently stores data inside a local JSON file.

Although suitable for development and demonstration, this approach is not recommended for production systems because it does not support high levels of concurrent access.

---

## Forecast Training

The LSTM model is trained whenever a forecast is generated.

Since model weights are not persisted, forecasts may vary slightly between requests.

---

## Limited Historical Data

Forecast quality depends on the availability of historical sales data.

Products with very little sales history automatically use the exponential smoothing fallback model.

---

## Mock Payment

The checkout flow demonstrates payment validation but does not connect to a real payment gateway.

No real financial transactions are processed.

---

## Image Management

Product images are referenced using URLs.

Direct image uploads are not currently supported.

---

## Password Recovery

Password reset and email verification have not yet been implemented.

---

## Deployment

The application has not yet been deployed to a production environment.

Deployment using Render and Vercel is planned for future releases.

---

# Contributing

Contributions, suggestions, and feedback are welcome.

If you would like to improve SmartMarketAI:

1. Fork the repository
2. Create a new feature branch

```bash
git checkout -b feature/your-feature
```

3. Commit your changes

```bash
git commit -m "Add new feature"
```

4. Push your branch

```bash
git push origin feature/your-feature
```

5. Open a Pull Request

---

# License

This project is intended for academic and educational purposes.

---

# Acknowledgements

This project was developed as part of a **Final Year Engineering Project**.

The project combines concepts from:

- Full-Stack Web Development
- Software Engineering
- Machine Learning
- Database Management Systems
- Web Security
- Inventory Management

Special thanks to the open-source community and the maintainers of:

- React
- Express.js
- Node.js
- Tailwind CSS
- Recharts
- JWT
- bcrypt

whose tools and libraries made this project possible.

---

# Author

**Kishan Thamban**

GitHub:

https://github.com/kishan-thamban

Repository:

https://github.com/kishan-thamban/smartmarket-ai

---

# Project Status

> **Status:** 🚧 Under Development

Core features have been implemented successfully.

Upcoming milestones include:

- MongoDB Atlas integration
- Cloud deployment
- Improved demand forecasting
- Enhanced analytics
- Additional inventory insights

---

## Summary

SmartMarketAI demonstrates the integration of modern web development technologies with machine learning techniques to create an intelligent inventory management platform for handmade product vendors.

The project showcases:

- Full-stack application development
- Secure authentication using JWT
- Role-based access control
- RESTful API development
- Custom JavaScript LSTM demand forecasting
- Database abstraction for future scalability
- Inventory recommendation based on predicted demand
- Clean, modular software architecture

While the current implementation is intended for academic purposes, the overall architecture provides a strong foundation for future production-ready enhancements.

---