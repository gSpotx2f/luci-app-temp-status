# luci-app-temp-status
Temperature sensors data for the LuCI status page (OpenWrt webUI).

OpenWrt >= 22.03.

**Dependences:** ucode, ucode-mod-fs.

## Installation notes

**OpenWrt >= 25.12:**

    wget --no-check-certificate -O /tmp/luci-app-temp-status-0.8.1-r1.apk https://github.com/gSpotx2f/packages-openwrt/raw/master/25.12/luci-app-temp-status-0.8.1-r1.apk
    apk --allow-untrusted add /tmp/luci-app-temp-status-0.8.1-r1.apk
    rm /tmp/luci-app-temp-status-0.8.1-r1.apk
    service rpcd restart

i18n-ru:

    wget --no-check-certificate -O /tmp/luci-i18n-temp-status-ru-0.8.1-r1.apk https://github.com/gSpotx2f/packages-openwrt/raw/master/25.12/luci-i18n-temp-status-ru-0.8.1-r1.apk
    apk --allow-untrusted add /tmp/luci-i18n-temp-status-ru-0.8.1-r1.apk
    rm /tmp/luci-i18n-temp-status-ru-0.8.1-r1.apk

**OpenWrt <= 24.10:**

    wget --no-check-certificate -O /tmp/luci-app-temp-status_0.8.1-r1_all.ipk https://github.com/gSpotx2f/packages-openwrt/raw/master/24.10/luci-app-temp-status_0.8.1-r1_all.ipk
    opkg install /tmp/luci-app-temp-status_0.8.1-r1_all.ipk
    rm /tmp/luci-app-temp-status_0.8.1-r1_all.ipk
    service rpcd restart

i18n-ru:

    wget --no-check-certificate -O /tmp/luci-i18n-temp-status-ru_0.8.1-r1_all.ipk https://github.com/gSpotx2f/packages-openwrt/raw/master/24.10/luci-i18n-temp-status-ru_0.8.1-r1_all.ipk
    opkg install /tmp/luci-i18n-temp-status-ru_0.8.1-r1_all.ipk
    rm /tmp/luci-i18n-temp-status-ru_0.8.1-r1_all.ipk

## Screenshots:

![](https://github.com/gSpotx2f/luci-app-temp-status/blob/master/screenshots/01.jpg)
