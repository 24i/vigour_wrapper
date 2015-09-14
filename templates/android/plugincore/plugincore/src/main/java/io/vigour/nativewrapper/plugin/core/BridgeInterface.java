package io.vigour.nativewrapper.plugin.core;

/**
 * Created by michielvanliempt on 09/04/15.
 */
public interface BridgeInterface {
    void respondError(int callId, String errorMessage);

    void respond(int callId, String response);
}
