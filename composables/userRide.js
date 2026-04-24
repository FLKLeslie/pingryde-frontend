import { ref } from "vue";

const rideId = ref(null);

export const useRide = () => {
  return {
    rideId
  };
};