# luci-app-temp-status
Temperature sensors data for the LuCI status page (OpenWrt webUI).

OpenWrt >= 19.07.

**Installation notes:**

    wget --no-check-certificate -O /tmp/luci-app-temp-status_0.1-1_all.ipk https://github.com/gSpotx2f/luci-app-temp-status/raw/master/packages/19.07/luci-app-temp-status_0.1-1_all.ipk
    opkg install /tmp/luci-app-temp-status_0.1-1_all.ipk
    rm /tmp/luci-app-temp-status_0.1-1_all.ipk
    /etc/init.d/rpcd restart

**i18n-ru:**

    wget --no-check-certificate -O /tmp/luci-i18n-temp-status-ru_0.1-1_all.ipk https://github.com/gSpotx2f/luci-app-temp-status/raw/master/packages/19.07/luci-i18n-temp-status-ru_0.1-1_all.ipk
    opkg install /tmp/luci-i18n-temp-status-ru_0.1-1_all.ipk
    rm /tmp/luci-i18n-temp-status-ru_0.1-1_all.ipk

**Screenshots:**

![](https://github.com/gSpotx2f/luci-app-temp-status/blob/master/screenshots/01.jpg)
