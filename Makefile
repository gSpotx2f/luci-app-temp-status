#
# Copyright (C) 2025 gSpot (https://github.com/gSpotx2f/luci-app-temp-status)
#
# This is free software, licensed under the MIT License.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-temp-status
PKG_VERSION:=0.5.0
PKG_RELEASE:=1
LUCI_TITLE:=Temperature sensors data for the LuCI status page
LUCI_DEPENDS:=+lua +luci-lib-nixio +luci-lib-jsonc
LUCI_PKGARCH:=all
PKG_LICENSE:=MIT

#include ../../luci.mk
include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
