import { useAuth } from "@/context/useAuth";
import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ServerOffline() {
    const { retryAuth } = useAuth();

    return (
        <div className="relative min-h-screen bg-background flex items-center justify-center p-4 overflow-hidden text-foreground">
            {/* Decorative blobs */}
            <div className="absolute top-[-15%] left-[-15%] w-[50%] h-[50%] bg-destructive/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[10s]"></div>
            <div className="absolute bottom-[-15%] right-[-15%] w-[50%] h-[50%] bg-orange-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[8s]"></div>

            <div className="relative z-10 text-center max-w-md mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Icon */}
                <div className="relative mx-auto w-24 h-24">
                    <div className="absolute inset-0 bg-destructive/10 rounded-full animate-ping opacity-20"></div>
                    <div className="relative flex items-center justify-center w-full h-full bg-destructive/10 dark:bg-destructive/20 rounded-full border-2 border-destructive/20">
                        <WifiOff className="w-10 h-10 text-destructive" strokeWidth={1.5} />
                    </div>
                </div>

                {/* Text */}
                <div className="space-y-3">
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                        Unable to Connect
                    </h1>
                    <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
                        The server is currently unreachable. We're trying to reconnect automatically.
                    </p>
                </div>

                {/* Reconnecting indicator */}
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground uppercase tracking-widest font-bold">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
                    </span>
                    Reconnecting...
                </div>

                {/* Manual retry button */}
                <Button
                    onClick={retryAuth}
                    variant="outline"
                    className="gap-2 font-bold border-border hover:bg-muted transition-all"
                >
                    <RefreshCw className="w-4 h-4" />
                    Retry Now
                </Button>
            </div>
        </div>
    );
}
