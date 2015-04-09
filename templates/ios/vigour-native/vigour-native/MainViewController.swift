//
//  ViewController.swift
//  vigour-native
//
//  Created by Alexander van der Werff on 06/04/15.
//  Copyright (c) 2015 Vigour.io. All rights reserved.
//



import WebKit
import UIKit

let scriptMessageHandlerName = "vigourBridgeHandler"

class MainViewController: UIViewController, WKScriptMessageHandler {
    
    //wrapper for web app
    var webView: WKWebView?
    
    lazy var userContentController: WKUserContentController = {
        let controller = WKUserContentController()
        controller.addScriptMessageHandler(self, name: scriptMessageHandlerName)
        return controller
    }()
    
    lazy var configuration: WKWebViewConfiguration = {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaPlaybackRequiresUserAction = true
        config.userContentController = self.userContentController
        return config
    }()

    
    required init(coder aDecoder: NSCoder) {
        super.init(coder: aDecoder)
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setup()
    }
    
    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
    }
    
    private func setup() {
        
        webView = WKWebView(frame: CGRectZero, configuration: configuration)
        
        loadApp()
        
        view.addSubview(webView!)
        webView!.setTranslatesAutoresizingMaskIntoConstraints(false)
        let height = NSLayoutConstraint(item: webView!, attribute: .Height, relatedBy: .Equal, toItem: view, attribute: .Height, multiplier: 1, constant: 0)
        let width = NSLayoutConstraint(item: webView!, attribute: .Width, relatedBy: .Equal, toItem: view, attribute: .Width, multiplier: 1, constant: 0)
        view.addConstraints([height, width])
        
    }
    
    private func loadApp() {
        //NOTE: - we asume index.html is there..
        let path = "\(webAplicationFolderPath)/index.html"
        //println(path)
        let url = NSURL(fileURLWithPath: path)
        webView!.loadRequest(NSURLRequest(URL: url!))
    }
    
    
    //MARK: - WKScriptMessageHandler
    
    func userContentController(userContentController: WKUserContentController, didReceiveScriptMessage message: WKScriptMessage) {
        
        println(message.name)
        println(message.body)

    }
    
    
}