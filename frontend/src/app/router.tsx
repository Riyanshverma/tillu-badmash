import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "../components/layout/app-shell";
import { DecisionPage } from "../pages/decision-page";
import { AccuracyPage } from "../pages/accuracy-page";
import { NotFoundPage } from "../pages/not-found-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <DecisionPage />,
      },
      {
        path: "accuracy",
        element: <AccuracyPage />,
      },
      {
        path: "404",
        element: <NotFoundPage />,
      },
      {
        path: "*",
        element: <Navigate to="/404" replace />,
      },
    ],
  },
]);
