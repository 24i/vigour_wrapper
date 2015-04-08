package io.vigour.cloudandroidwrapper.plugin;

import java.lang.reflect.Method;
import java.util.AbstractMap;
import java.util.TreeMap;

/**
 * Created by michielvanliempt on 08/04/15.
 */
public class VigourPlugin {
    private String name;
    private AbstractMap<String, PluginFunction> functions = new TreeMap<>();

    public VigourPlugin() {
        for (Method m : getClass().getMethods()) {
            if (m.getDeclaringClass() == getClass()) {
                register(new ReflectivePluginFunction(m.getName(), m, this));
            }
        }
    }
    
    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public PluginFunction getFunction(String functionName) {
        return functions.get(functionName);
    }

    protected void register(PluginFunction function) {
        functions.put(function.getName(), function);
    }
}
