import { Shield } from "lucide-react";

export function CopyrightFooter() {
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
  
  if (!isDemoMode) return null;
  
  return (
    <footer className="bg-gray-900 text-white py-4 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center space-x-2 text-sm">
          <Shield className="h-4 w-4" />
          <span>
            © {new Date().getFullYear()} GroupOrder Hub - All Rights Reserved. 
            This is a demo version. Unauthorized reproduction, distribution, or modification of this software is strictly prohibited.
          </span>
        </div>
      </div>
    </footer>
  );
}
