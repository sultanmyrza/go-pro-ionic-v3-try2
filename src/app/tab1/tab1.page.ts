import { Component } from '@angular/core';
import {
  BleClient,
  dataViewToText,
  numbersToDataView,
  ScanResult,
} from '@capacitor-community/bluetooth-le';
import { Http } from '@capacitor-community/http';
import { Wifi } from '@capacitor-community/wifi';
import { ToastController } from '@ionic/angular';
@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
})
export class Tab1Page {
  bluetoothScanResults: ScanResult[] = [];
  bluetoothIsScanning = false;

  bluetoothConnectedDevice?: ScanResult;
  bluetoothConnectedDeviceServiceId?: string;

  readonly goproBaseUrl = 'http://10.5.5.9:8080';

  readonly goProControlAndQueryServiceUUID =
    '0000fea6-0000-1000-8000-00805f9b34fb'.toUpperCase();

  readonly goProWifiAccessPointServiceUUID =
    `b5f90001-aa8d-11e3-9046-0002a5d5c51b`.toUpperCase();

  readonly goProCommandReqCharacteristicsUUID =
    'b5f90072-aa8d-11e3-9046-0002a5d5c51b'.toUpperCase();

  readonly goProWifiSSIDCharacteristicUUID =
    `b5f90002-aa8d-11e3-9046-0002a5d5c51b`.toUpperCase();

  readonly goProWifiPASSCharacteristicUUID =
    `b5f90003-aa8d-11e3-9046-0002a5d5c51b`.toUpperCase();

  readonly shutdownCommand = [0x01, 0x05];

  readonly shutterCommand = [3, 1, 1, 1];

  readonly enableGoProWiFiCommand = [3, 17, 1, 1];

  constructor(public toastController: ToastController) {}

  async scanForBluetoothDevices() {
    try {
      await BleClient.initialize();

      this.bluetoothScanResults = [];
      this.bluetoothIsScanning = true;

      await BleClient.requestLEScan(
        { services: [] },
        this.onBluetoothDeviceFound.bind(this)
      );

      const stopScanAfterMilliSeconds = 3500;
      setTimeout(async () => {
        await BleClient.stopLEScan();
        this.bluetoothIsScanning = false;
        console.log('stopped scanning');
      }, stopScanAfterMilliSeconds);
    } catch (error) {
      this.bluetoothIsScanning = false;
      console.error('scanForBluetoothDevices', error);
    }
  }

  onBluetoothDeviceFound(result) {
    console.log('received new scan result', result);
    this.bluetoothScanResults.push(result);
  }

  async connectToBluetoothDevice(scanResult: ScanResult) {
    const device = scanResult.device;

    try {
      await BleClient.connect(
        device.deviceId,
        this.onBluetooDeviceDisconnected.bind(this)
      );

      this.bluetoothConnectedDevice = scanResult;
      // TODO: check if its not null
      this.bluetoothConnectedDeviceServiceId = scanResult.uuids[0];
      console.log('connected to device', device);
      console.log('connectedDevice', this.bluetoothConnectedDevice);
      console.log(
        'connectedDeviceServiceId',
        this.bluetoothConnectedDeviceServiceId
      );
      this.presentToast(
        `connected to device ${device.name ?? device.deviceId}`
      );
    } catch (error) {
      console.error('connectToDevice', error);
      this.presentToast(JSON.stringify(error));
    }
  }

  async disconnectFromBluetoothDevice(scanResult: ScanResult) {
    const device = scanResult.device;
    try {
      await BleClient.disconnect(scanResult.device.deviceId);
      alert(`disconnected from device ${device.name ?? device.deviceId}`);
    } catch (error) {
      console.error('disconnectFromDevice', error);
    }
  }

  onBluetooDeviceDisconnected(disconnectedDeviceId: string) {
    alert(`Diconnected ${disconnectedDeviceId}`);
    this.bluetoothConnectedDevice = undefined;
    this.bluetoothConnectedDeviceServiceId = undefined;
  }

  async sendBluetoothWriteCommand(command: number[]) {
    if (!this.bluetoothConnectedDevice) {
      this.presentToast('Bluetooth device not connected');
      return;
    }

    const commandDataView = numbersToDataView(command);

    try {
      await BleClient.write(
        this.bluetoothConnectedDevice.device.deviceId,
        this.goProControlAndQueryServiceUUID,
        this.goProCommandReqCharacteristicsUUID,
        commandDataView
      );
      this.presentToast('command sent');
    } catch (error) {
      console.log(`error: ${JSON.stringify(error)}`);
      this.presentToast(JSON.stringify(error));
    }
  }

  sendBluetoothReadCommand(command: number[]) {
    if (!this.bluetoothConnectedDevice) {
      return;
    }

    // TODO: find better solution for comparing 2 arrays with numbers
    if (JSON.stringify(command) === JSON.stringify(this.shutdownCommand)) {
      this.getGoProWiFiCreds();
    }
  }

  sendWiFiReadCommand() {
    // TODO: && check if wifi was connected
    if (!this.bluetoothConnectedDevice) {
      return;
    }
    throw new Error('Method not implemented.');
  }

  sendWifiWriteCommand() {
    if (!this.bluetoothConnectedDevice) {
      return;
    }
    throw new Error('Method not implemented.');
  }

  async getGoProWiFiCreds(): Promise<{ wifiPASS: string; wifiSSID: string }> {
    const device = this.bluetoothConnectedDevice.device;

    try {
      const wifiSSID = dataViewToText(
        await BleClient.read(
          device.deviceId,
          this.goProWifiAccessPointServiceUUID,
          this.goProWifiSSIDCharacteristicUUID
        )
      );

      const wifiPASS = dataViewToText(
        await BleClient.read(
          device.deviceId,
          this.goProWifiAccessPointServiceUUID,
          this.goProWifiPASSCharacteristicUUID
        )
      );
      this.presentToast(`GoPro WiFi SSID: ${wifiSSID} PASS: ${wifiPASS}`);
      console.log({ wifiSSID, wifiPASS });

      return { wifiSSID, wifiPASS };
    } catch (error) {
      console.error('getGoProWiFiCreds', JSON.stringify(error));
      this.presentToast(`${JSON.stringify(error)}`);
    }
  }

  async connectToGoProWifi() {
    if (!this.bluetoothConnectedDevice) {
      return;
    }

    await this.sendBluetoothWriteCommand(this.enableGoProWiFiCommand);
    const { wifiSSID, wifiPASS } = await this.getGoProWiFiCreds();

    try {
      // this.presentToast(`Wifi.connectPrefix`);
      // console.log(`Connecting to ${wifiSSID} with password ${wifiPASS}`);
      // await Wifi.connectPrefix({
      //   ssid: wifiSSID,
      //   password: wifiPASS,
      // })
      this.presentToast(`Wifi.connect`);
      console.log(`Connecting to ${wifiSSID} with password ${wifiPASS}`);
      await Wifi.connect({
        ssid: wifiSSID,
        password: wifiPASS,
      })
        .then((result) => {
          console.warn(`connectToGoProWifi.result`, result);
          this.presentToast(`Connected to ${JSON.stringify(result.ssid)}`);
        })
        .catch((error: any) => {
          console.error(`connectToGoProWifi.error`);
          console.error(error);
          this.presentToast(`Wifi.connect().catch() ${JSON.stringify(error)}`);
        });
    } catch (error) {
      console.error(`connectToGoProWifi.error`);
      console.error(error);
      this.presentToast(
        `await Wifi.connect() catch() ${JSON.stringify(error)}`
      );
    }
  }

  async loadImagesFromGoPro() {
    const url = this.goproBaseUrl + '/gopro/media/list';

    try {
      const response = await Http.get({ url });

      const fileNames: string[] = (response.data.media[0].fs as any[]).map(
        (e) => e.n
      );

      const imageUrls = fileNames
        .filter((e) => e.toLowerCase().includes('.jpg'))
        .map((e) => `${this.goproBaseUrl}/videos/DCIM/100GOPRO/${e}`);

      const videoUrls = fileNames
        .filter((e) => e.toLowerCase().includes('.mp4'))
        .map((e) => `${this.goproBaseUrl}/videos/DCIM/100GOPRO/${e}`);

      console.log('imageUrls', imageUrls);
      console.log('videoUrls', videoUrls);
      this.presentToast('Successfully fetched go pro media');
    } catch (error) {
      console.error(error);
      this.presentToast('Failed to fetch go pro media');
    }
  }

  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 1700,
    });
    toast.present();
  }
}
