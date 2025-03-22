import dynamic from "next/dynamic";

// Import the NotionClone component with client-side rendering only
const NotionClone = dynamic(() => import("../components/NotionClone"), {
  ssr: false,
});
export default function Home() {
  return <NotionClone />;
}
