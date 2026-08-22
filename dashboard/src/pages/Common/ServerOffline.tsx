import { useAuth } from '@/context/useAuth';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ServerOffline({ isOverlay = false }: { isOverlay?: boolean }) {
  const { retryAuth } = useAuth();

  return (
    <div
      className={`${isOverlay ? 'bg-background/60 fixed inset-0 z-9999 backdrop-blur-md' : 'bg-background relative min-h-screen'} text-foreground flex items-center justify-center overflow-hidden p-4`}
    >
      {/* Decorative blobs */}
      <div className="bg-destructive/10 pointer-events-none absolute top-[-15%] left-[-15%] h-[50%] w-[50%] animate-pulse rounded-full blur-[120px] duration-[10s]"></div>
      <div className="pointer-events-none absolute right-[-15%] bottom-[-15%] h-[50%] w-[50%] animate-pulse rounded-full bg-orange-500/10 blur-[120px] duration-[8s]"></div>

      <div className="animate-in fade-in slide-in-from-bottom-4 relative z-10 mx-auto max-w-md space-y-8 text-center duration-700">
        {/* Icon */}
        <div className="relative mx-auto h-24 w-24">
          <div className="bg-destructive/10 absolute inset-0 animate-ping rounded-full opacity-20"></div>
          <div className="bg-destructive/10 dark:bg-destructive/20 border-destructive/20 relative flex h-full w-full items-center justify-center rounded-full border-2">
            <WifiOff className="text-destructive h-10 w-10" strokeWidth={1.5} />
          </div>
        </div>

        {/* Text */}
        <div className="space-y-3">
          <h1 className="text-foreground text-2xl font-black tracking-tight sm:text-3xl">
            Unable to Connect
          </h1>
          <p className="text-muted-foreground mx-auto max-w-xs text-sm leading-relaxed">
            The server is currently unreachable. We're trying to reconnect automatically.
          </p>
        </div>

        {/* Reconnecting indicator */}
        <div className="text-muted-foreground flex items-center justify-center gap-2 text-xs font-bold tracking-widest uppercase">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-500"></span>
          </span>
          Reconnecting...
        </div>

        {/* Manual retry button */}
        <Button
          onClick={retryAuth}
          variant="outline"
          className="border-border hover:bg-muted gap-2 font-bold transition-[color,background-color,border-color,box-shadow,opacity,transform]"
        >
          <RefreshCw className="h-4 w-4" />
          Retry Now
        </Button>
      </div>
    </div>
  );
}
