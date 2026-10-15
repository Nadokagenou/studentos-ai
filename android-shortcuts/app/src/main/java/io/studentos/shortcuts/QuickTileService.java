package io.studentos.shortcuts;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

public final class QuickTileService extends TileService {
    @Override public void onStartListening() {
        Tile tile = getQsTile();
        if (tile != null) { tile.setState(Tile.STATE_INACTIVE); tile.setLabel("เพิ่มงาน Student OS"); tile.updateTile(); }
    }
    @Override public void onClick() {
        super.onClick();
        Runnable open = () -> {
            Intent panel = new Intent(this,RouteActivity.class).putExtra("route","quick").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            if (Build.VERSION.SDK_INT >= 34) startActivityAndCollapse(PendingIntent.getActivity(this,0,panel,PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            else startActivityAndCollapse(panel);
        };
        if (isLocked()) unlockAndRun(open); else open.run();
    }
}
