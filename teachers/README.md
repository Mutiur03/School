# Teacher Dashboard (Next.js)

This is a Next.js project for the Teacher Dashboard, designed to match the Student Dashboard in style and features.

## Features

- Teacher authentication (login/logout)
- Responsive dashboard with profile and password change
- Navbar with teacher info and theme switcher
- Profile page showing teacher details
- Change password functionality
- Uses Tailwind CSS for styling

## Getting Started

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Folder Structure

- `app/` - Next.js pages and routing
- `components/` - UI and layout components
- `context/` - Authentication context

## API Endpoints

- `/api/auth/teacher_login` - Teacher login
- `/api/auth/teacher_me` - Get current teacher
- `/api/teachers/change-password` - Change password

## Customization

You can modify the UI components in `components/ui/` for custom styles.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
