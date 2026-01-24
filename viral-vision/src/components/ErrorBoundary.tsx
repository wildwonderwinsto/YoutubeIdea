import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-4 text-center text-white">
                    <div className="mb-4 rounded-full bg-red-500/20 p-4">
                        <AlertTriangle className="h-12 w-12 text-red-500" />
                    </div>
                    <h1 className="mb-2 text-2xl font-bold">Something went wrong</h1>
                    <p className="mb-6 max-w-md text-gray-400">
                        {this.state.error?.message || "An unexpected error occurred."}
                    </p>
                    <Button
                        onClick={() => window.location.reload()}
                        className="bg-white text-black hover:bg-gray-200"
                    >
                        Reload Application
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
