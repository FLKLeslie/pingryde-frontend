<script setup>
import { onMounted } from "vue";
import { useSocket } from "~/composables/useSocket";

let driverMarker;
let passengerMarker;

onMounted(async () => {
  const L = await import("leaflet");

  const socket = useSocket();

  const map = L.map("map").setView([5.47, 10.41], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

  passengerMarker = L.marker([5.47, 10.41]).addTo(map);
  driverMarker = L.marker([5.48, 10.42]).addTo(map);

  socket.on("driverLocation", (data) => {
    driverMarker.setLatLng([data.lat, data.lng]);
  });

  socket.on("passengerLocation", (data) => {
    passengerMarker.setLatLng([data.lat, data.lng]);
  });
});
</script>

<template>
  <div id="map" style="height: 500px;"></div>
</template>