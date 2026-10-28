# PrimeCart — E-Commerce Management Dashboard

PrimeCart is a modern, responsive e-commerce management platform built with **Next.js 16, React 19, TypeScript, Tailwind CSS 4, Firebase Authentication, and Cloud Firestore**. It provides an integrated dashboard for managing products, orders, customers, inventory, sales analytics, and customer shopping workflows.

The interface uses a clean **green, beige, and black color palette**, combining a professional dashboard experience with a simple and user-friendly storefront.

## ✨ Features

### 📊 Dashboard
- Overview of total sales, orders, products, and customers.
- Sales summaries and visual analytics.
- Recent orders and key business statistics.
- Responsive dashboard layout with sidebar navigation.

### 📦 Product Management
- Add, view, edit, search, and delete products.
- Manage product names, descriptions, categories, prices, and stock.
- Support products with multiple colors and products with no color variations.
- Manage stock separately for each product color.
- Support any number of product colors without a predefined limit.
- Display color-specific availability and stock status.
- Automatically mark an individual color as **Out of Stock** when its quantity reaches zero.
- Keep available colors purchasable even when another color is out of stock.
- Synchronize product images and color variations where configured.
- Filter and organize products for easier administration.

### 🎨 Color-Wise Inventory Management
- Assign multiple colors to a single product.
- Set and update inventory quantities for individual colors.
- Display the selected color's availability on the customer-facing store.
- Prevent customers from selecting unavailable color variations.
- Maintain stock for products that have only one color or no color variations.
- Keep product availability and inventory information consistent across the management dashboard and storefront.

### 🛍️ Customer Storefront
- Browse available products.
- View product information, images, prices, and stock status.
- Select available product colors where applicable.
- Choose quantities according to product availability.
- Add products to the shopping cart.
- Continue through the checkout and order-placement flow.
- Display unavailable color variations as out of stock.

### 🧾 Order Management
- View and manage customer orders.
- Review order details and ordered products.
- Update order statuses.
- Track order progress through the order-management workflow.
- Keep order-related inventory and sales information consistent with the configured application logic.

### 👥 Customer Management
- View customer information associated with orders.
- Review customer order activity where available.
- Search and manage customer records according to the implemented dashboard functionality.

### 📉 Inventory Management
- Monitor product stock levels.
- Identify low-stock products.
- Track stock availability for individual product colors.
- Update inventory from the product-management interface.
- Reflect stock changes in product availability.

### 📈 Sales & Analytics
- View sales summaries and business statistics.
- Analyze order and sales information.
- Display charts and visual reports using Recharts.
- Monitor key e-commerce performance indicators.

### 🔔 Notifications
- Display notifications for supported order and status events.
- Keep notifications available when navigating between dashboard pages.
- Allow individual notifications to be removed.
- Support clearing all notifications.
- Preserve notification history in browser storage where implemented.

**Note:** Browser-local notification storage is device- and browser-specific; it does not automatically synchronize notification history across different devices.

### 🔐 Authentication & Account Security
- User registration and login using Firebase Authentication.
- Email verification flow.
- Forgot-password functionality.
- Password reset through the configured email flow.
- Protected dashboard access according to the application's authentication checks.

### ⚙️ Settings
- Access the dashboard's settings page.
- Manage available account or application preferences supported by the implementation.

## 🎨 Design & User Experience

PrimeCart follows a clean and modern design system featuring:

- **Primary color:** Green.
- **Background color:** Beige.
- **Text and contrast color:** Black.
- Consistent cards, tables, forms, and navigation.
- Clear buttons, input fields, and status indicators.
- Responsive layouts for desktop, tablet, and mobile.
- Interactive elements and hover states.
- Lucide React icons.
- Accessible visual contrast and readable typography.

The green, beige, and black palette provides a consistent visual identity across the dashboard, product-management pages, and customer shopping experience.

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| Next.js 16 | React framework and application routing |
| React 19 | User interface |
| TypeScript | Type-safe development |
| Tailwind CSS 4 | Styling and responsive layouts |
| Firebase Authentication | User authentication |
| Cloud Firestore | Product, order, and application data |
| Recharts | Charts and sales analytics |
| Lucide React | Icons |
| npm | Package management |

## 🌐 Local Application Links

Start the development server before opening these links.

| Page | Local URL |
|---|---|
| Main Dashboard / Authentication | [http://localhost:3000/](http://localhost:3000/) |
| Product Management | [http://localhost:3000/products](http://localhost:3000/products) |
| Order Management | [http://localhost:3000/orders](http://localhost:3000/orders) |
| Customer Management | [http://localhost:3000/customers](http://localhost:3000/customers) |
| Inventory | [http://localhost:3000/inventory](http://localhost:3000/inventory) |
| Analytics | [http://localhost:3000/analytics](http://localhost:3000/analytics) |
| Settings | [http://localhost:3000/settings](http://localhost:3000/settings) |
| Customer Store | [http://localhost:3000/store](http://localhost:3000/store) |
| Checkout | [http://localhost:3000/checkout](http://localhost:3000/checkout) |
| Login | [http://localhost:3000/login](http://localhost:3000/login) |
| Sign Up | [http://localhost:3000/signup](http://localhost:3000/signup) |
| Email Verification | [http://localhost:3000/verify-email](http://localhost:3000/verify-email) |
| Forgot Password | [http://localhost:3000/forgot-password](http://localhost:3000/forgot-password) |
| Reset Password | [http://localhost:3000/reset-password](http://localhost:3000/reset-password) |

**Important:** These are local development URLs, not public deployment links. A route will open only if its corresponding page exists in the project. Authentication-related pages may require the appropriate login state or URL parameters.

## 📋 Prerequisites

Before running PrimeCart, install:

- Node.js (a version compatible with the installed Next.js release).
- npm.
- A Firebase project.
- A configured Cloud Firestore database.
- Firebase Authentication providers and email settings required by the application.

## 🚀 Getting Started

### 1. Navigate to the project

```bash
cd ecommerce-dashboard
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root and add the Firebase configuration values required by your code.

Example:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

Use the actual values from your Firebase project. The variable names must match those referenced in your Firebase configuration file.

**Security:** Never commit real credentials, private keys, service-account files, or sensitive environment variables to a public repository. Keep `.env.local` out of Git.

### 4. Configure Firebase

1. Create or select your Firebase project.
2. Register the web application.
3. Add the required Firebase configuration to `.env.local`.
4. Enable the authentication methods used by the application.
5. Configure email verification and password-reset emails.
6. Create and configure the required Firestore collections.
7. Set Firestore security rules that allow authorized users to access the data they need while protecting customer and order information.

Do not use unrestricted Firestore rules in production.

### 5. Start the development server

```bash
npm run dev
```

Open:

[http://localhost:3000/](http://localhost:3000/)
[http://localhost:3000/store](http://localhost:3000/store)

### 6. Create a production build

```bash
npm run build
```

Start the production server locally after a successful build:

```bash
npm run start
```

## 📁 Project Structure

The project uses the Next.js App Router. The exact files may vary depending on the features implemented.

```text
ecommerce-dashboard/
├── app/
│   ├── api/
│   │   ├── orders/
│   │   └── products/
│   ├── analytics/
│   ├── checkout/
│   ├── customers/
│   ├── forgot-password/
│   ├── inventory/
│   ├── login/
│   ├── orders/
│   ├── order/
│   ├── products/
│   ├── reset-password/
│   ├── settings/
│   ├── signup/
│   ├── store/
│   ├── verify-email/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── DashboardLayout.tsx
│   ├── Sidebar.tsx
│   └── Topbar.tsx
├── lib/
│   ├── firebase.ts
│   └── firestore.ts
├── public/
├── .env.local
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

This is a representative structure. Keep only the routes and files that exist in your actual project.

## 🗃️ Data & Inventory Workflow

PrimeCart uses Firebase services for authentication and cloud data storage.

The product-management workflow supports product details, pricing, categories, images, and inventory information. Where color variations are configured, stock is tracked by color so each variation can have its own availability status.

For example:

| Product | Color | Stock | Status |
|---|---|---:|---|
| Example Product | Black | 10 | In Stock |
| Example Product | Green | 3 | Low Stock |
| Example Product | Beige | 0 | Out of Stock |

This table is an illustration of the intended color-wise inventory behavior, not live product data.

When a customer selects a product variation, the application should validate the selected color and quantity against the latest available stock before accepting the order. Inventory should be updated safely to prevent overselling when multiple orders are placed at the same time.

## 🔒 Security & Best Practices

- Keep Firebase credentials and local environment files out of version control.
- Configure Firestore security rules according to user roles and data access requirements.
- Validate product quantities and prices on the trusted side of the order workflow.
- Prevent customers from ordering unavailable color variations.
- Protect administrative operations against unauthorized access.
- Avoid exposing private customer information.
- Test authentication, permissions, checkout, and stock updates before deployment.

## 🧪 Testing Checklist

Before submitting or deploying the project, verify:

- [ ] Registration and login work correctly.
- [ ] Email verification works.
- [ ] Forgot-password and reset-password flows work.
- [ ] Dashboard routes follow the intended authentication rules.
- [ ] Products can be created, updated, and deleted.
- [ ] Product search and filtering work.
- [ ] Products with multiple colors display the correct variations.
- [ ] Products without color variations remain supported.
- [ ] Each color has independent stock and availability.
- [ ] A color with zero stock is unavailable without disabling other in-stock colors.
- [ ] Checkout validates product quantities and availability.
- [ ] Order creation and status updates work correctly.
- [ ] Inventory changes remain consistent with orders.
- [ ] Notifications remain visible during dashboard navigation.
- [ ] Dashboard charts and summaries display the expected data.
- [ ] The application works on desktop and mobile layouts.
- [ ] Firestore permissions and production security rules are tested.

## 📱 Responsive Design

PrimeCart is designed to provide a consistent experience across different screen sizes, including:

- Desktop computers.
- Laptops.
- Tablets.
- Mobile devices.

Navigation, cards, forms, tables, and product layouts should adapt to the available screen width.

## 🔮 Future Improvements

Potential enhancements include:

- Advanced sales reports and date-range filters.
- Role-based access for administrators and staff.
- Server-side validation and stronger order-processing safeguards.
- Payment gateway integration.
- Product reviews and ratings.
- Customer order tracking.
- Low-stock alerts and inventory reports.
- Automated testing and deployment workflows.

These are potential improvements and should not be considered implemented until they are added and tested.

## 👩‍💻 Development

PrimeCart is built with a modular Next.js architecture, reusable React components, Firebase services, and TypeScript to support maintainable development and future expansion.

To contribute, create a branch, implement and test your changes, and submit a pull request through your chosen Git workflow.

## 📄 License

No license has been specified yet. Add a `LICENSE` file if you intend to distribute the project under a particular open-source license.

---

**PrimeCart — Smart Inventory. Simple Management. Seamless Shopping.**
