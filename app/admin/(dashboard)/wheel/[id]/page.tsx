"use client";

import { useParams } from "next/navigation";
import WheelCalibrator from "@/components/admin/WheelCalibrator";

export default function WheelFaceCalibratorPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  if (!id) return null;
  return <WheelCalibrator wheelFaceId={id} />;
}
