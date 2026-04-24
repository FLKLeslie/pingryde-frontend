<script setup>
import { onMounted } from "vue";
import { useSocket } from "~/composables/useSocket";
// import { useRide } from "@/composables/useRide";

const socket = useSocket();
const { rideId } = useRide();

const DRIVER_ID = "PUT_REAL_DRIVER_ID";

onMounted(() => {

  socket.emit("driverOnline", DRIVER_ID);

  socket.on("rideAccepted", (ride) => {
    rideId.value = ride._id;

    socket.emit("joinRide", { rideId: rideId.value });

    navigator.geolocation.watchPosition((position) => {
      socket.emit("driverLocationUpdate", {
        rideId: rideId.value,
        lat: position.coords.latitude,
        lng: position.coords.longitude
      });
    });
  });

});
</script>

<template>
  <h1>Driver Dashboard</h1>
</template>