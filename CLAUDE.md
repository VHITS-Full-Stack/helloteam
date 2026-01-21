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
