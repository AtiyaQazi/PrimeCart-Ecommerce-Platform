# PrimeCart — E-Commerce Management Dashboard

PrimeCart is a modern, responsive e-commerce management platform built with **Next.js 16, React 19, TypeScript, Tailwind CSS 4, Firebase Authentication, and Cloud Firestore**. It provides an integrated dashboard for managing products, orders, customers, inventory, sales analytics, notifications, account settings, and customer shopping workflows.

The interface uses a clean **green, beige, and black color palette**, combining a professional dashboard experience with a simple, user-friendly storefront.

## ✨ Features

### 📊 Dashboard
- Overview of total sales, orders, products, and customers.
- Sales summaries and visual analytics.
- Recent orders and key business statistics.
- Responsive dashboard layout with sidebar navigation.
- Consistent dashboard styling across management pages.

### 📦 Product Management
- Add, view, edit, search, and delete products.
- Manage product names, descriptions, categories, prices, images, and stock.
- Support products with multiple colors and products without color variations.
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
- Recalculate overall product stock from color-specific stock where supported.

### 🛍️ Customer Storefront
- Browse available products.
- View product information, images, descriptions, prices, and stock status.
- Select available product colors where applicable.
- Choose quantities according to product availability.
- Add products to the shopping cart.
- View product details on dedicated product pages.
- Continue through the checkout and order-placement flow.
- Display unavailable color variations as out of stock.
- Maintain cart information in browser storage where implemented.
- Provide customer checkout options supported by the application.

### 🧾 Order Management
- View and manage customer orders.
- Review order details and ordered products.
- Update order statuses.
- Track order progress through the order-management workflow.
- Support order status handling for Pending, Processing, Completed, and Cancelled orders.
- Apply payment-status and sales-record rules according to the configured order workflow.
- Keep order-related inventory and sales information consistent with the configured application logic.
- Restore or deduct inventory during supported order-status transitions.

### 👥 Customer Management
- View customer information associated with orders.
- Review customer order activity where available.
- Search and manage customer records according to the implemented dashboard functionality.
- Synchronize customer information from orders where supported by the application.

### 📉 Inventory Management
- Monitor product stock levels.
- Identify low-stock products.
- Track stock availability for individual product colors.
- Update inventory from the product-management interface.
- Reflect stock changes in product availability.
- Display low-stock and out-of-stock information in inventory summaries.

### 📈 Sales Analytics & Reports Dashboard

The Analytics page provides a consolidated view of store performance through key metrics, charts, order summaries, and inventory statistics.

**Key performance metrics**
- **Total Revenue:** Displays eligible sales revenue for the selected date range.
- **Total Orders:** Shows the number of orders created during the selected period.
- **Average Order Value (AOV):** Calculates average revenue per eligible sales order.
- **Units Sold:** Calculates the quantity of items included in eligible sales orders.

**Sales-over-time chart**
- Displays daily sales revenue in a line chart.
- Provides a visual representation of revenue fluctuations over the selected period.
- Includes date labels and revenue values.
- Updates the chart when the date-range filter changes.

**Revenue by product category**
- Displays revenue grouped by product category.
- Shows category-wise revenue totals and percentage contributions.
- Uses visual progress bars to compare category performance.
- Uses product information to determine category attribution where available.

**Date-range filters**
- Last 7 days.
- Last 30 days.
- Last 90 days.

Changing the selected period updates the relevant sales metrics, line chart, category revenue breakdown, order-status counts, and recent-orders list.

**CSV report export**
- Export daily sales data for the selected period.
- Includes dates, revenue in PKR, and eligible sales-order counts.
- Downloads a CSV file that can be opened in spreadsheet applications.

**Order and inventory reports**
- Displays Completed, Processing, Pending, and Cancelled order counts.
- Shows product counts and total stock units.
- Identifies low-stock products and products that are out of stock.
- Displays product-category counts.
- Shows recent orders with customer details, product information, amounts, statuses, and dates.

**Sales calculation rules**

The Analytics page follows the configured order workflow:
- Online orders count toward sales unless their status is Cancelled.
- Cash on Delivery (COD) orders count toward sales when their status is Completed.
- The average order value is calculated using eligible sales orders.
- Units sold are calculated from items in eligible sales orders.

**Data source:** The current Analytics implementation uses live Firestore order and product data. It is not a mock-data-only implementation. Analytics values depend on the available order records, product information, timestamps, and configured Firestore permissions.

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
- Account security information on the Settings page.

### ⚙️ Settings
- Manage the store name and administrator email where supported.
- Enable or disable the email-notification preference.
- Save supported settings to Firestore.
- Display saving, success, and error states.
- Use consistent typography, spacing, card styling, and alignment matching the Analytics dashboard.

The Settings page uses the same green, beige, and black design system as the rest of the dashboard.

## 🎨 Design & User Experience

PrimeCart follows a clean and modern design system featuring:

- **Primary color:** Green.
- **Background color:** Beige.
- **Text and contrast color:** Black.
- Consistent cards, tables, forms, and navigation.
- Standardized font sizes and spacing across dashboard pages.
- Aligned headings, descriptions, labels, buttons, and content sections.
- Clear buttons, input fields, and status indicators.
- Responsive layouts for desktop, tablet, and mobile.
- Interactive elements and hover states.
- Lucide React icons.
- Readable typography and accessible visual contrast.

The green, beige, and black palette provides a consistent visual identity across the dashboard, product-management pages, Analytics, Settings, and customer shopping experience.

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| Next.js 16 | React framework and application routing |
| React 19 | User interface |
| TypeScript | Type-safe development |
| Tailwind CSS 4 | Styling and responsive layouts |
| Firebase Authentication | User authentication |
| Cloud Firestore | Product, order, customer, and settings data where configured |
| SVG and CSS chart elements | Sales visualizations in the current Analytics implementation |
| Recharts | Charting library if used by other project pages |
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
| Sales Analytics | [http://localhost:3000/analytics](http://localhost:3000/analytics) |
| Settings | [http://localhost:3000/settings](http://localhost:3000/settings) |
| Customer Store | [http://localhost:3000/store](http://localhost:3000/store) |
| Product Details | `/store/product/[id]` |
| Checkout | [http://localhost:3000/checkout](http://localhost:3000/checkout) |
| Login | [http://localhost:3000/login](http://localhost:3000/login) |
| Sign Up | [http://localhost:3000/signup](http://localhost:3000/signup) |
| Email Verification | [http://localhost:3000/verify-email](http://localhost:3000/verify-email) |
| Forgot Password | [http://localhost:3000/forgot-password](http://localhost:3000/forgot-password) |
| Reset Password | [http://localhost:3000/reset-password](http://localhost:3000/reset-password) |

**Important:** These are local development URLs, not public deployment links. A route will open only if its corresponding page exists in the project. Authentication-related pages may require the appropriate login state or URL parameters.

## 📋 Prerequisites

Before running PrimeCart, install:

- Node.js compatible with the installed Next.js release.
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

If your project uses Firebase Admin SDK functionality, configure its required server-side environment variables separately according to the server code.

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

- [http://localhost:3000/](http://localhost:3000/)
- [http://localhost:3000/store](http://localhost:3000/store)
- [http://localhost:3000/analytics](http://localhost:3000/analytics)

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
│   │   └── product/
│   ├── verify-email/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── dashboard/
│   └── layout/
├── lib/
│   ├── firebase.ts
│   ├── firestore.ts
│   └── productImages.ts
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

## 📊 Analytics Data Workflow

The Analytics page reads order and product information from Firestore and derives the displayed metrics.

1. Orders are loaded and sorted by creation date.
2. The selected date range determines which orders are included in the period-based reports.
3. Sales eligibility is calculated according to the configured payment method and order status.
4. Revenue and average order value are calculated from eligible sales.
5. Units sold are calculated from the quantities in eligible order items.
6. Daily revenue is grouped by date for the sales line chart.
7. Revenue is grouped by product category using product IDs and product records where available.
8. Order-status counts and recent orders are updated for the selected date range.
9. CSV export generates a daily report for the selected period.

If an older order does not contain a matching product ID, its category may appear as **Other**. Analytics accuracy depends on the quality and consistency of stored order data.

## 🔒 Security & Best Practices

- Keep Firebase credentials and local environment files out of version control.
- Configure Firestore security rules according to user roles and data access requirements.
- Validate product quantities and prices on the trusted side of the order workflow.
- Prevent customers from ordering unavailable color variations.
- Protect administrative operations against unauthorized access.
- Avoid exposing private customer information.
- Test authentication, permissions, checkout, and stock updates before deployment.
- Validate sales calculations against real order records.
- Test date filtering and CSV exports with empty and populated datasets.

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
- [ ] Analytics metrics display the expected values.
- [ ] The 7-day, 30-day, and 90-day filters update the reports.
- [ ] The sales line chart displays revenue by date.
- [ ] Revenue by category is calculated correctly.
- [ ] CSV export downloads the selected period's report.
- [ ] Settings can be saved and loaded.
- [ ] Analytics and Settings have consistent font sizes and alignment.
- [ ] The application works on desktop and mobile layouts.
- [ ] Firestore permissions and production security rules are tested.

## 📱 Responsive Design

PrimeCart is designed to provide a consistent experience across different screen sizes, including:

- Desktop computers.
- Laptops.
- Tablets.
- Mobile devices.

Navigation, cards, forms, tables, analytics charts, and product layouts should adapt to the available screen width.

## 🔮 Future Improvements

Potential enhancements include:

- Advanced sales reports with additional export formats.
- Dedicated date comparison and growth-rate metrics.
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