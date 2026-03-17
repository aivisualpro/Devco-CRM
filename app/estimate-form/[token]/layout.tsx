import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "../../globals.css";
import { ToasterProvider } from "@/components/ui/ToasterProvider";

export const metadata: Metadata = {
    title: "DEVCO | Project Details Form",
    description: "Fill out project details for your estimate",
    icons: {
        icon: "/favicon.png",
        apple: "/favicon.png",
    },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: "#0F4C75",
};

export default function EstimateFormLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
