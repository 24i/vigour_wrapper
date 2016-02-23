//
//  ViewController.swift
//  vigour-native
//
//  Created by Alexander van der Werff on 06/04/15.
//  Copyright (c) 2015 Vigour.io. All rights reserved.
//



import WebKit
import UIKit

private let webApplicationRootFolderName = NSBundle.mainBundle().pathForResource("www", ofType: nil)

let webAplicationFolderPath = ""

public class VigourViewController: UIViewController, VigourBridgeViewController, WKUIDelegate, WKNavigationDelegate {
    
    public var vigourBridge:VigourBridge = VigourBridge()
    
    public var statusBarHidden = true {
        didSet {
            setNeedsStatusBarAppearanceUpdate()
        }
    }
    
    public var statusBarStyle: UIStatusBarStyle = .Default {
        didSet {
            setNeedsStatusBarAppearanceUpdate()
        }
    }
    
    public var autoRotate = true
    
    //wrapper for web app
    public var webView: WKWebView?
    
    lazy var userContentController: WKUserContentController = { [unowned self] in
        let controller = WKUserContentController()
        controller.addScriptMessageHandler(self.vigourBridge, name: VigourBridge.scriptMessageHandlerName())
        self.vigourBridge.delegate = self
        
        let source = "window.vigour = window.vigour || {};window.vigour.native = window.vigour.native || {};window.vigour.native.webview = true;";
        let script = WKUserScript(source: source, injectionTime:.AtDocumentStart, forMainFrameOnly: true)
        controller.addUserScript(script)
        
        #if DEBUG
//        let source = "console.log = function(){var msg = Array.prototype.join.call(arguments, ' '); window.webkit.messageHandlers.\(VigourBridge.scriptMessageHandlerName()).postMessage({pluginId:'vigour.logger', fnName: 'log', opts:{message:msg}})}"
//        let script = WKUserScript(source: source, injectionTime:.AtDocumentStart, forMainFrameOnly: true)
//        controller.addUserScript(script)
        #endif
        
        return controller
    }()
    
    lazy var configuration: WKWebViewConfiguration = {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.requiresUserActionForMediaPlayback = false
        config.userContentController = self.userContentController
        return config
    }()
    
    lazy var appplicationIndexPath: String = {
        if let path = NSBundle.mainBundle().pathForResource("Info", ofType: "plist") {
            let dict = NSDictionary(contentsOfFile: path)
            if let path = dict?.objectForKey("appIndexPath") as? String {
                return path
            }
        }
        return "index.html"
    }()
    
    
    public required init?(coder aDecoder: NSCoder) {
        super.init(coder: aDecoder)
    }
    
    public override func viewDidLoad() {
        super.viewDidLoad()
        setup()
        loadApp()
    }
    
    public override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
    }
    
    private func setup() {
        
        webView = WKWebView(frame: CGRectZero, configuration: configuration)
        webView?.UIDelegate = self
        webView?.navigationDelegate = self
        webView?.scrollView.bounces = false
        view.addSubview(webView!)
        
        //extend user agent
        webView?.evaluateJavaScript("navigator.userAgent", completionHandler: {[weak self] (result, error) -> Void in
            var device = ""
            switch UIDevice.currentDevice().userInterfaceIdiom {
            case .Phone:
                device = "phone"
            case .Pad:
                device = "tablet"
            default:break
            }
            if let agent = result, let weakSelf = self, let view = weakSelf.webView {
                view.customUserAgent! = "\(agent) vigour-wrapper \(device)"
            }
        })
        
        webView!.translatesAutoresizingMaskIntoConstraints = false
        let height = NSLayoutConstraint(item: webView!, attribute: .Height, relatedBy: .Equal, toItem: view, attribute: .Height, multiplier: 1, constant: 0)
        let width = NSLayoutConstraint(item: webView!, attribute: .Width, relatedBy: .Equal, toItem: view, attribute: .Width, multiplier: 1, constant: 0)
        view.addConstraints([height, width])
        
    }
    
    private func loadApp() {
        let filePath = "\(webApplicationRootFolderName!)/\(appplicationIndexPath)"
        let url = NSURL(fileURLWithPath: filePath)
        webView!.loadFileURL(url, allowingReadAccessToURL: url)
    }
    
    override public func prefersStatusBarHidden() -> Bool {
        return statusBarHidden
    }
    
    override public func preferredStatusBarUpdateAnimation() -> UIStatusBarAnimation {
        return UIStatusBarAnimation.Slide
    }
    
    override public func preferredStatusBarStyle() -> UIStatusBarStyle {
        return statusBarStyle
    }
    
    override public func shouldAutorotate() -> Bool {
        return autoRotate
    }
    
    
    //MARK: - WKNavigationDelegate
    
    public func webView(webView: WKWebView, didFinishNavigation navigation: WKNavigation!) {
        //TODO: maybe wait for some js event...
        //vigourBridge.activate()
    }
    
    
    //MARK: - WKUIDelegate
    
    public func webView(webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: () -> Void) {
        let alertController = UIAlertController(title: webView.URL?.host, message: message, preferredStyle: UIAlertControllerStyle.Alert)
        alertController.addAction(UIAlertAction(title: "Close", style: UIAlertActionStyle.Default, handler: { (action) -> Void in
            completionHandler()
        }))
        presentViewController(alertController, animated: true, completion: nil)
    }
    
}