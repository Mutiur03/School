import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="bg-background text-foreground flex h-screen w-full flex-col items-center justify-center px-4 text-center">
      <h1 className="text-primary text-6xl font-bold tracking-tight">404</h1>
      <p className="mt-4 text-xl font-semibold">Page Not Found</p>
      <p className="text-muted-foreground mt-2 text-sm">
        Sorry, the page you’re looking for doesn’t exist or has been moved.
      </p>

      <Link
        to="/"
        className="bg-primary text-background mt-6 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition hover:opacity-90"
      >
        <ArrowLeft className="h-4 w-4" />
        Go Back Home
      </Link>
    </div>
  );
}
