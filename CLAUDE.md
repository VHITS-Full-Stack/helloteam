# Hello Team - Claude Code Guidelines

This document contains project-specific guidelines and design decisions for Claude Code to follow when working on this project.

## UI/UX Guidelines

### Modal/Popup Design
- **Background**: All modals/popups should have a **transparent or semi-transparent background** with a subtle blur effect
- Current implementation: `bg-black/20 backdrop-blur-sm` (20% black opacity with blur)
- Do NOT use solid black backgrounds like `bg-black bg-opacity-50`
- The modal content itself should have a white background with rounded corners and shadow

### Color Scheme
- Primary color: Uses Tailwind primary color palette
- Use consistent spacing and typography throughout the app

## Code Patterns

### API Response Handling
All API calls follow this pattern:
```javascript
try {
  const response = await service.methodName(data);
  if (response.success) {
    // Close modal and reset form FIRST
    setShowModal(false);
    resetForm();
    setError('');
    // Then refresh data in the background
    fetchData();
  } else {
    setError(response.error || 'Default error message');
  }
} catch (err) {
  setError(err.error || err.message || 'Default error message');
} finally {
  setSubmitting(false);
}
```

### Service Layer
- Services are located in `frontend/src/services/`
- All API services return `response.data` from axios (which contains `{ success, data, error, message }`)
- Throw errors in catch blocks to propagate them to the calling component

## Technology Stack

### Frontend
- React.js with Vite
- Tailwind CSS for styling
- React Router v6 for routing
- Axios for API calls
- Lucide React for icons

### Backend
- Node.js with Express
- TypeScript
- PostgreSQL with Prisma ORM
- JWT for authentication

## Invoice Generation Logic

Invoices are auto-generated based on the client's **Agreement Type** (set when adding a client).

### Weekly
- **Period**: Monday – Sunday
- **Auto-generated**: Every **Wednesday** (for the previous Mon–Sun)
- **Manual**: Admin selects week number → generates immediately

### Bi-Weekly (Half-Month)
- **Period 1**: 1st – 15th of the month
  - **Auto-generated**: On the **17th** of the same month
- **Period 2**: 16th – End of month
  - **Auto-generated**: On the **3rd** of the next month
- **Manual**: Admin selects month + period (1st–15th or 16th–End) → generates immediately
- Auto/cron only processes clients with `agreementType: BI_WEEKLY`

### Monthly
- **Period**: 1st – End of month
- **Auto-generated**: On the **3rd** of the next month
- **Manual**: Admin selects month → generates immediately

### Key Rules
- Cron jobs only process clients matching the agreement type (WEEKLY, BI_WEEKLY, MONTHLY)
- Manual triggers generate invoices **immediately** regardless of schedule
- Existing invoices for the same period are skipped (no duplicates)
- Only APPROVED / AUTO_APPROVED time records are included
- Late-approved overtime from previous periods can be included in the current invoice

### Cron Schedule (UTC)
| Job | Schedule | Cron Expression |
|-----|----------|-----------------|
| Weekly | Every Wednesday 05:10 UTC | `10 5 * * 3` |
| Bi-Weekly | 3rd & 17th 05:15 UTC | `15 5 3,17 * *` |
| Monthly | 3rd of month 05:05 UTC | `5 5 3 * *` |

## Project Structure

```
helloteam/
├── frontend/
│   ├── src/
│   │   ├── components/common/    # Reusable UI components
│   │   ├── pages/               # Page components by role
│   │   ├── services/            # API service layer
│   │   └── hooks/               # Custom React hooks
├── backend/
│   └── src/
│       ├── controllers/         # Route handlers
│       ├── routes/              # API routes
│       ├── middleware/          # Auth and other middleware
│       └── config/              # Configuration files
└── deliverables/                # Project documentation
```
