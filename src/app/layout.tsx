import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "ShowFlow - Trình chiếu đơn giản",
  description: "Ứng dụng trình chiếu đơn giản, hỗ trợ hình ảnh, video, trang web, PowerPoint và thông báo chữ. Chiếu qua màn hình 2 (máy chiếu).",
  keywords: ["ShowFlow", "trình chiếu", "presentation", "OBS", "projector"],
  authors: [{ name: "ShowFlow" }],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="dark" suppressHydrationWarning>
      <body
        className="antialiased bg-background text-foreground"
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
