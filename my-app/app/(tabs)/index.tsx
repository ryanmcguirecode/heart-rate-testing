import { requestPermissions } from "../useBLE";
import { useEffect, useState } from "react";
import { BleManager, Device } from "react-native-ble-plx";
import { View, Text } from "react-native";

const HEART_RATE_SERVICE_UUID = "0000180d-0000-1000-8000-00805f9b34fb";
const HEART_RATE_CHARACTERISTIC_UUID = "00002a37-0000-1000-8000-00805f9b34fb"; // Standard UUID for Heart Rate Measurement
const deviceName = "WHOOP 4C0693040";

export default function HomeScreen() {
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const bleManager = new BleManager();

  useEffect(() => {
    // Request permissions and start scanning when component mounts
    requestPermissions().then(() => {
      scanForHeartRateMonitors();
    });

    // Cleanup BLE scanning when component unmounts
    return () => {
      bleManager.stopDeviceScan();
    };
  }, []);

  const scanForHeartRateMonitors = () => {
    setHeartRate(null);
    setConnectedDevice(null);

    bleManager.startDeviceScan(null, null, async (error, device) => {
      if (error) {
        console.log("Scan error:", error);
        return;
      }

      if (
        device &&
        device.name === deviceName &&
        device.serviceUUIDs?.includes(HEART_RATE_SERVICE_UUID)
      ) {
        console.log(`Found heart rate monitor: ${device.name}`);

        // Stop scanning & connect to the first found device
        bleManager.stopDeviceScan();
        await connectToHeartRateMonitor(device);
      }
    });

    // Stop scanning after 10 seconds to save battery
    setTimeout(() => bleManager.stopDeviceScan(), 10000);
  };

  const connectToHeartRateMonitor = async (device: Device) => {
    try {
      const connectedDevice = await device.connect();
      await connectedDevice.discoverAllServicesAndCharacteristics();

      const services = await connectedDevice.services();
      for (const service of services) {
        if (service.uuid === HEART_RATE_SERVICE_UUID) {
          const characteristics = await service.characteristics();
          for (const char of characteristics) {
            if (char.uuid === HEART_RATE_CHARACTERISTIC_UUID) {
              console.log("Enabling notifications for Heart Rate...");

              // Enable notifications explicitly before monitoring
              const enableNotificationValue = btoa(String.fromCharCode(0x01));
              await char.writeWithoutResponse(enableNotificationValue);

              char.monitor((error, characteristic) => {
                if (error) {
                  console.log("Heart Rate subscription error:", error);
                  return;
                }
                if (characteristic?.value) {
                  const heartRateValue = parseHeartRate(characteristic.value);
                  setHeartRate(heartRateValue);
                }
              });

              console.log("Heart Rate notifications enabled!");
            }
          }
        }
      }

      setConnectedDevice(connectedDevice);
    } catch (error) {
      console.log("Connection error:", error);
    }
  };

  const parseHeartRate = (data: string) => {
    console.log("Raw base64 data:", data);

    // Decode base64 using atob()
    const decoded = atob(data);
    const rawData = new Uint8Array(decoded.length);

    for (let i = 0; i < decoded.length; i++) {
      rawData[i] = decoded.charCodeAt(i);
    }

    const heartRate = rawData[1] ?? 0;
    console.log("Parsed heart rate:", heartRate);

    return heartRate;
  };

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      {connectedDevice ? (
        <View>
          <Text style={{ fontSize: 20, fontWeight: "bold" }}>
            Connected to: {connectedDevice.name || "Unknown Device"}
          </Text>
          <Text style={{ fontSize: 24, marginTop: 10 }}>
            ❤️ Heart Rate: {heartRate ?? "--"} BPM
          </Text>
        </View>
      ) : (
        <Text style={{ marginTop: 20, fontSize: 16 }}>
          Scanning for heart rate monitor...
        </Text>
      )}
    </View>
  );
}
