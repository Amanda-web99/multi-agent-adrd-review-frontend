import { createBrowserRouter, Outlet } from "react-router";
import UploadPage from "./components/UploadPage";
import ADRDReview from "./components/ADRDReview";

function Root() {
  return <Outlet />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: UploadPage },
      { path: "review", Component: ADRDReview },
      { path: "*", Component: UploadPage },
    ],
  },
]);
