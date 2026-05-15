export const revalidate = 60;

export default async function Layout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="min-h-screen text-black">
            <br />
            <div className="main-content-full">
                <div className="content-part-1">{children}</div>
            </div>
        </div>
    );
}
